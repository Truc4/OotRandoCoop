// This is Lynn the fake test client.
// She mimics a normal OotRandoCoop client for testing purposes during development.

const VERSION = "@major@.@minor@.@buildNumber@";
const IO_Client = require('socket.io-client');
const crypto = require('crypto');
const zlib = require('zlib');
const aes256 = require('aes256');
const fs = require("fs");

let master_server_ip = "127.0.0.1";
let master_server_port = "8081";
let GAME_ROOM = "strong-catfish-32";
let nickname = "Lynn";
let my_uuid = "";
const ENC_KEY = crypto.createHash('md5').update(VERSION).digest("hex");

var OotStorage = null;
let OotOverlay_data = {};
let SceneStorage = {};
let FlagStorage = {};
let SkulltulaStorage = {};
// Pierre takes up so much space he deserves his own object... lol.
let ScarecrowStorage = null;
let DungeonStorage = {
    items: {}
};
let DungeonKeyTrackers = {};


function sendDataToMaster(data) {
    websocket.emit('msg', GAME_ROOM, encodeDataForClient({
        uuid: my_uuid,
        nickname: nickname,
        payload: data
    }));
}

function sendDataToMasterOnChannel(channel, data) {
    websocket.emit(channel, GAME_ROOM, encodeDataForClient({
        uuid: my_uuid,
        nickname: nickname,
        payload: data
    }));
}

function decodeDataFromClient(pack) {
    let decompress = zlib.inflateSync(pack).toString();
    let decrypt = aes256.decrypt(ENC_KEY, decompress);
    return JSON.parse(decrypt);
}

function encodeDataForClient(data) {
    let stringify = JSON.stringify(data);
    let encrypt = aes256.encrypt(ENC_KEY, stringify);
    return zlib.deflateSync(encrypt);
}

function loadSave(f) {
    let t = JSON.parse(fs.readFileSync(f));
    OotStorage = t.storage;
    SceneStorage = t.scenes;
    FlagStorage = t.flags;
    SkulltulaStorage = t.skulls;
}

const websocket = new IO_Client("http://" + master_server_ip + ":" + master_server_port);

websocket.on('connect', function () {
    websocket.emit('room', encodeDataForClient({
        nickname: nickname,
        room: GAME_ROOM,
        password: crypto.createHash('md5').update("").digest("hex")
    }));
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
        console.log("Request for room " + GAME_ROOM + " was denied due to an invalid password.");
    }
    loadSave("Lynn_save.json");
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


websocket.on('msg', function (data) {
    let parse = decodeDataFromClient(data);
    console.log(parse);
});

websocket.on('resync_resp', function (data) {
    let parse = decodeDataFromClient(data);
    if (parse.payload.target === my_uuid) {
        for (let i = 0; i < parse.payload.packets.length; i++) {
            console.log(parse.payload.packets[i]);
        }
    }
});

websocket.on('resync', function (data) {
    let parse = decodeDataFromClient(data);
    if (parse.payload.resync_me) {
        // Build full sync package.
        let packets = [];
        Object.keys(OotStorage).forEach(function (key) {
            let p = {packet_id: key};
            p[key] = OotStorage[key];
            packets.push(p);
        });
        Object.keys(SceneStorage.scene_data).forEach(function (key) {
            let p = {packet_id: "scene_" + key, scene_data: {scene_data: {}}};
            p.scene_data.scene_data = SceneStorage.scene_data[key];
            p.scene_data.addr = key;
            packets.push(p);
        });
        Object.keys(FlagStorage.flag_data).forEach(function (key) {
            let p = {packet_id: "flag_" + key, flag_data: {}};
            p.flag_data[key] = FlagStorage.flag_data[key];
            packets.push(p);
        });
        Object.keys(SkulltulaStorage.skulltulas).forEach(function (key) {
            let p = {packet_id: "skulltulas_" + key, skulltulas: {}};
            p.skulltulas[key] = SkulltulaStorage.skulltulas[key];
            packets.push(p);
        });
        Object.keys(DungeonStorage.items).forEach(function (key) {
            let p = {packet_id: "dungeon_items", dungeon_items: DungeonStorage.items[key], addr: key};
            packets.push(p);
        });
        Object.keys(DungeonKeyTrackers).forEach(function (key) {
            let p = {
                packet_id: "resync_keys",
                tracker: {
                    addr: key,
                    value: DungeonKeyTrackers[key].keyCount,
                    timestamp: DungeonKeyTrackers[key].last_timestamp
                }
            };
            packets.push(p);
        });
        sendDataToMasterOnChannel('resync_resp', {packets: packets, target: parse.uuid});
    }
});