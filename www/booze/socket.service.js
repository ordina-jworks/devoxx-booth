(function () {
    'use strict';

    angular
        .module('booze')
        .service("socketService", socketService);

    socketService.$inject = ['$interval','$window'];

    function socketService($interval, $window) {

        //Internal variables.
        var nodeSocket = null;
        var callbacks = [];

        //Kick things into gear!
        connectToWebsocket();

        this.sendJSONMessage = function (jsonMessage) {
            nodeSocket.send(JSON.stringify(jsonMessage));
        };

        this.registerCallback = function (callback) {
            callbacks.push(callback);
        };

        function connectToWebsocket() {
            nodeSocket = new WebSocket("ws://"+$window.location.hostname+":7081");

            //Wait for the socket connection to be established before doing anything else socket related!
            nodeSocket.onopen = function (event) {
                console.log("Connection to web socket established!");

                nodeSocket.onmessage = function (event) {
                    console.log("Received message from web socket:" + event.data);
                    var data = JSON.parse(event.data);

                    for(var i = 0; i < callbacks.length; i++) {
                        switch(data.level){
                            case 'FULL' :
                                callbacks[i](100);
                                break;
                            case 'HIGH' :
                                callbacks[i](75);
                            break;
                            case 'MEDIUM' :
                                callbacks[i](50);
                            break;
                            case 'LOW' :
                                callbacks[i](25);
                                break;
                            case 'EMPTY' :
                                callbacks[i](0);
                                break;
                            default :
                        }
                    }
                }
            };

            //var height = 100;
            //
            //$interval(function(){
            //    height!==0? height -= 25 : height = 100;
            //
            //    callbacks.forEach(function(cb){
            //        cb(height)
            //    });
            //},10000);
        }
    }

})();