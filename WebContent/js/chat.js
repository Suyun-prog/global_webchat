$(function () {
	  var ChatManager = (function () {
	    function ChatManager() {
	    }

	    ChatManager.textarea = $('#chat-box');
	    ChatManager.socket = null;
	    ChatManager.stompClient = null;
	    ChatManager.sessionId = null;
	    ChatManager.chatRoomId = null;
	    ChatManager.joinInterval = null;
	    ChatManager.fromlang=null;
	    ChatManager.tolang=null;
	    
	    //ChatManager <Join> <Error> <Cancel> 기능 json으로 서버에 전달
	    //Join
	    ChatManager.join = function () {
	      $.ajax({
	        url       : 'join',
	        headers   : {
	          "Content-Type": "application/json"
	        },
	        beforeSend: function () {
	          $('#btnJoin').text('Cancel');
	          ChatManager.updateText('>> waiting anonymous user', false);
	          ChatManager.joinInterval = setInterval(function () {
	            ChatManager.updateText('.', true);
	          }, 1000);
	        },
	        success   : function (chatResponse) {
	          console.log('Success to receive join result. \n', chatResponse);
	          if (!chatResponse) {
	            return;
	          }

	          clearInterval(ChatManager.joinInterval);
	          if (chatResponse.responseResult == 'SUCCESS') {
	            ChatManager.sessionId = chatResponse.sessionId;
	            ChatManager.fromlang = chatResponse.fromlang;
	            ChatManager.tolang = chatResponse.tolang;
	            ChatManager.chatRoomId = chatResponse.chatRoomId;
	            ChatManager.updateTemplate('chat');
	            ChatManager.updateText('>> 채팅이 시작되었습니다\n', false);
	            ChatManager.connectAndSubscribe();
	          } else if (chatResponse.responseResult == 'CANCEL') {
	            ChatManager.updateText('>> Success to cancel', false);
	            $('#btnJoin').text('Join');
	          } else if (chatResponse.responseResult == 'TIMEOUT') {
	            ChatManager.updateText('>> Can`t find user :(', false);
	            $('#btnJoin').text('Join');
	          }
	        },
	        error     : function (jqxhr) {
	          clearInterval(ChatManager.joinInterval);
	          if (jqxhr.status == 503) {
	            ChatManager.updateText('\n>>> 유저를 찾지 못했습니다 \n다시 시도해주세요', true);
	          } else {
	            ChatManager.updateText(jqxhr, true);
	          }
	          console.log(jqxhr);
	        },
	        complete  : function () {
	          clearInterval(ChatManager.joinInterval);
	        }
	      })
	    };

	    //Cancel
	    ChatManager.cancel = function () {
	      $.ajax({
	        url     : 'cancel',
	        headers : {
	          "Content-Type": "application/json"
	        },
	        success : function () {
	          ChatManager.updateText('', false);
	        },
	        error   : function (jqxhr) {
	          console.log(jqxhr);
	          alert('Error occur. please refresh');
	        },
	        complete: function () {
	          clearInterval(ChatManager.joinInterval);
	        }
	      })
	    };
	    
		//stomp 연결 구독
	    ChatManager.connectAndSubscribe = function () {
	      if (ChatManager.stompClient == null || !ChatManager.stompClient.connected) {
	        var socket = new SockJS('/chat-websocket');
	        ChatManager.stompClient = Stomp.over(socket);
	        ChatManager.stompClient.connect({chatRoomId: ChatManager.chatRoomId}, function (frame) {
	          console.log('Connected: ' + frame);
	          ChatManager.subscribeMessage();
	        });
	      } else {
	        ChatManager.subscribeMessage();
	      }
	    };
	    //연결 끊겼을때 템플릿 업데이트
	    ChatManager.disconnect = function () {
	      if (ChatManager.stompClient !== null) {
	        ChatManager.stompClient.disconnect();
	        ChatManager.stompClient = null;
	        ChatManager.updateTemplate('wait');
	      }
	    };
		
	    
	    //stomp 메시지 전송
	    ChatManager.sendMessage = function () {
	      console.log('Check.. >>\n', ChatManager.stompClient);
	      console.log('send message.. >> ');
	      var $chatTarget = $('#textarea-message');
	      var message = $chatTarget.val();
	      $chatTarget.val('');

	      var payload = {
	        messageType    : 'CHAT',
	        senderSessionId: ChatManager.sessionId,
	        message        : message,
	        fromlang : ChatManager.fromlang,
	        tolang: ChatManager.tolang
	      };

	      ChatManager.stompClient.send('/chat.message/' + ChatManager.chatRoomId, {}, JSON.stringify(payload));
	    };
	    
	    
	    
		
	    ChatManager.appendMessageTag = function (LR_className, senderName, message) {
	        let chatLi = $('div.chat.format ul li').clone();
	        
	        // 값 채우기
	        chatLi.addClass(LR_className);
	        chatLi.find('.sender span').text(senderName);
	        chatLi.find('.message span').text(message);
	 
	        $('div.chat:not(.format) ul').append(chatLi);
	 
	        // 스크롤바 아래 고정
	        $(document).scrollTop($(document).height());
	    }
	    
	    
	 
	    //stomp 메시지 수신 (채팅창에 메시지 띄우기)
	    ChatManager.subscribeMessage = function () {
	      ChatManager.stompClient.subscribe('/topic/chat/' + ChatManager.chatRoomId, function (resultObj) {
	        console.log('>> success to receive message\n', resultObj.body);
	        var result = JSON.parse(resultObj.body);
	        var message = '';
			var LR = '';
			var senderName='';


	        if (result.messageType == 'CHAT') {
	          if (result.senderSessionId === ChatManager.sessionId) {
	        	    LR="right";
	        	    senderName="나" ;

	          } else {
	        	    LR="left";
	        	    senderName="상대방";

	          }
	          ChatManager.appendMessageTag(LR, senderName, result.message);
	          console.log(ChatManager.country);
	          
	        } else if (result.messageType == 'DISCONNECTED') {
	          ChatManager.updateText('>> 상대방이 나갔습니다 ', false);
	          ChatManager.disconnect();
	        }
	        


	      });
	    };
		

	    
	    //템플릿 업데이트(버튼->입력창)
	    ChatManager.updateTemplate = function (type) {
	      var source;
	      if (type == 'wait') {
	        source = $('#wait-template').html();
	      } else if (type == 'chat') {
	        source = $('#input-template').html();
	      } else {
	        console.log('invalid type : ' + type);
	        return;
	      }
	      var template = Handlebars.compile(source);
	      var $target = $('#chat-action-div');
	      $target.empty();
	      $target.append(template({}));
	    };

	    //메시지창 메시지 업데이트
	    ChatManager.updateText = function (message, append) {
	      if (append) {
	        ChatManager.textarea.text(ChatManager.textarea.text() + message);
	      } else {
	        ChatManager.textarea.text(message);
	      }
	    };


	    return ChatManager;
	  }());
	      
	  // 해당  btn text가  'Join'일 경우 접속하고 'cancel'이면 취소
	  $(document).on('click', '#btnJoin', function () {
	    var type = $(this).text();
	    if (type == 'Join') {
	      ChatManager.join();
	    } else if (type == 'Cancel') {
	      ChatManager.cancel();
	    }
	  });



	  $(document).on('keydown', 'div.input-div textarea',function(e){
      	if(($(this).val()).replace(/\s| /gi, "").length != 0 ){
        	if(e.keyCode == 13 && !e.shiftKey) {
            	e.preventDefault();
            	// 메시지 전송
            	ChatManager.sendMessage();
        	}
    	}
      });
			  

	  ChatManager.updateTemplate('wait');
});