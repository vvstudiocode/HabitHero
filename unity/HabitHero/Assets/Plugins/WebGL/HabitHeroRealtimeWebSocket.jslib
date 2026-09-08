mergeInto(LibraryManager.library, {
  HabitHeroRealtimeConnect: function (targetObjectNamePtr, urlPtr) {
    var targetObjectName = UTF8ToString(targetObjectNamePtr);
    var url = UTF8ToString(urlPtr);
    if (typeof WebSocket === 'undefined') {
      SendMessage(targetObjectName, 'OnRealtimeError', 'WebSocket is unavailable in this browser.');
      return;
    }

    if (!globalThis.HabitHeroRealtimeSockets) globalThis.HabitHeroRealtimeSockets = {};
    var socket = new WebSocket(url);
    globalThis.HabitHeroRealtimeSockets[targetObjectName] = socket;
    socket.onopen = function () {
      SendMessage(targetObjectName, 'OnRealtimeOpen', '');
    };
    socket.onmessage = function (event) {
      if (typeof event.data === 'string') {
        SendMessage(targetObjectName, 'OnRealtimeMessage', event.data);
        return;
      }

      SendMessage(targetObjectName, 'OnRealtimeError', 'Supabase Realtime returned a non-text frame.');
    };
    socket.onerror = function () {
      SendMessage(targetObjectName, 'OnRealtimeError', 'Supabase Realtime WebSocket error.');
    };
    socket.onclose = function () {
      SendMessage(targetObjectName, 'OnRealtimeClose', '');
      delete globalThis.HabitHeroRealtimeSockets[targetObjectName];
    };
  },

  HabitHeroRealtimeSend: function (targetObjectNamePtr, messagePtr) {
    var targetObjectName = UTF8ToString(targetObjectNamePtr);
    var socket = globalThis.HabitHeroRealtimeSockets &&
      globalThis.HabitHeroRealtimeSockets[targetObjectName];
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(UTF8ToString(messagePtr));
  },

  HabitHeroRealtimeClose: function (targetObjectNamePtr) {
    var targetObjectName = UTF8ToString(targetObjectNamePtr);
    var socket = globalThis.HabitHeroRealtimeSockets &&
      globalThis.HabitHeroRealtimeSockets[targetObjectName];
    if (socket) socket.close(1000, 'HabitHero closed the realtime channel.');
  }
});
