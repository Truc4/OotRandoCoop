// This is Lynn the fake test client.
// She mimics a normal OotRandoCoop client for testing purposes during development.

const IO_Client = require('socket.io-client');
const lzw = require("node-lzw");

let master_server_ip = "127.0.0.1";
let master_server_port = "8081";
let GAME_ROOM = "test-room-1";
let nickname = "Lynn";
let my_uuid = "";

function decodeDataFromClient(pack) {
    return JSON.parse(lzw.decode(pack));
}

function encodeDataForClient(data) {
    return lzw.encode(JSON.stringify(data));
}

const websocket = new IO_Client("http://" + master_server_ip + ":" + master_server_port);

websocket.on('connect', function () {
    websocket.emit('room', encodeDataForClient({room: GAME_ROOM, password: ""}));
});

websocket.on('room_verified', function (data) {
    let parse = decodeDataFromClient(data);
    if (parse.verified) {
        console.log("Client: Successfully joined room: " + GAME_ROOM + ".");
        websocket.emit('room_check', GAME_ROOM, encodeDataForClient({
            uuid: my_uuid,
            nickname: nickname
        }));
    } else {
        console.log("Request for room " + parse.room + " was denied due to an invalid password.");
    }
});

websocket.on('id', function (data) {
    let parse = decodeDataFromClient(data);
    my_uuid = parse.id;
    console.log("Client: My UUID: " + my_uuid);
});

websocket.on('client_joined', function (data) {
    let parse = decodeDataFromClient(data);
    console.log(parse.nickname + " has joined the game!");
});

websocket.on('room_check', function (data) {
    let parse = decodeDataFromClient(data);
    websocket.emit('room_check_resp', GAME_ROOM, encodeDataForClient({
        uuid: my_uuid,
        nickname: nickname,
        toClient: parse.uuid
    }));
});

websocket.on('room_check_resp', function (data) {
    let parse = decodeDataFromClient(data);
    console.log("Connected player: " + parse.nickname + ".");
});

websocket.on('initial_sync', function (data) {
    console.log(decodeDataFromClient(data));
});

websocket.on('msg', function (data) {
    let parse = decodeDataFromClient(data);
    console.log(parse);
});