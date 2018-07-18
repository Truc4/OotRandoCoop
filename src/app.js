/*Copyright 2018 Mathew Miller (denoflions)

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/

const VERSION = "@major@.@minor@.@buildNumber@";
console.log("Oot Rando Co-op Node v" + VERSION + " loading...");
console.log("Coded by: denoflions.");
console.log("Primary testers: Delphirus & Liberalpeacock");

// Requires
const restify = require('restify');
const fs = require("fs");
const net = require('net');
const serveStatic = require('serve-static-restify');
const lzw = require("node-lzw");
const natUpnp = require('nat-upnp');
const IO_Server = require('socket.io');
const IO_Client = require('socket.io-client');
const hri = require('human-readable-ids').hri;
const libui = require('libui-node');
const crypto = require('crypto');

class GUI {
    constructor() {
        this._controls = {};
        this._window = libui.UiWindow("Oot Rando Co-op Node", 400, 300, true);
        this._window.margined = 1;
        this._form = new libui.UiForm();
        this._form.padded = true;
        this._hBox = new libui.UiVerticalBox();
        this._hBox.padded = true;
        this._hBox.append(this._form, 1);
        this._window.setChild(this._hBox);

        this._window.onClosing(() => {
            this._window.close();
            libui.stopLoop();
            process.exit();
        });

        (function (inst) {
            GUI.createTextBox(inst, inst.form, "Nickname", CONFIG.nickname, function () {
                CONFIG.nickname = inst.controls["Nickname"].text;
                CONFIG.save();
            });
            GUI.createTextBox(inst, inst.form, "Server", CONFIG.master_server_ip, function () {
                CONFIG.master_server_ip = inst.controls["Server"].text;
                CONFIG.save();
            });
            GUI.createTextBox(inst, inst.form, "Port", CONFIG.master_server_port, function () {
                CONFIG.master_server_port = inst.controls["Port"].text;
                CONFIG.save();
            });
            GUI.createTextBox(inst, inst.form, "Room", CONFIG.GAME_ROOM, function () {
                CONFIG.GAME_ROOM = inst.controls["Room"].text;
                CONFIG.save();
            });
            GUI.createPasswordBox(inst, inst.form, "Password", CONFIG.game_password, function () {
                CONFIG.game_password = inst.controls["Password"].text;
                CONFIG.save();
            });
            GUI.createCheckBox(inst, inst.form, "Run Master Server?", CONFIG.isMaster, function () {
                CONFIG.isMaster = inst.controls["Run Master Server?"].getChecked();
                CONFIG.save();
            });
            GUI.createCheckBox(inst, inst.form, "Run Client?", CONFIG.isClient, function () {
                CONFIG.isClient = inst.controls["Run Client?"].getChecked();
                CONFIG.save();
            });
            GUI.createCheckBox(inst, inst.form, "Run Tracker?", CONFIG.isTracker, function () {
                CONFIG.isTracker = inst.controls["Run Tracker?"].getChecked();
                CONFIG.save();
            });
            GUI.createButton(inst, inst.hBox, "Connect", "Connect", function () {
                if (CONFIG.isMaster) {
                    if (master === null) {
                        master = new MasterServer();
                        master.setup();
                    }
                }
                if (CONFIG.isClient) {
                    client = new Client();
                    client.setup();
                }
            });
        })(this);
        this._window.show();
        libui.startLoop();
    }

    get controls() {
        return this._controls;
    }

    set controls(value) {
        this._controls = value;
    }

    get form() {
        return this._form;
    }

    set form(value) {
        this._form = value;
    }

    get hBox() {
        return this._hBox;
    }

    set hBox(value) {
        this._hBox = value;
    }

    get name() {
        return this._name;
    }

    set name(value) {
        this._name = value;
    }

    get window() {
        return this._window;
    }

    set window(value) {
        this._window = value;
    }

    static createTextBox(inst, parent, name, value, callback = function () {
    }) {
        inst.controls[name] = new libui.UiEntry();
        inst.controls[name].text = value;
        inst.controls[name].onChanged(callback);
        parent.append(name, inst.controls[name], 0);
    }

    static createPasswordBox(inst, parent, name, value, callback = function () {
    }) {
        inst.controls[name] = new libui.UiPasswordEntry();
        inst.controls[name].text = value;
        inst.controls[name].onChanged(callback);
        parent.append(name, inst.controls[name], 0);
    }

    static createButton(inst, parent, name, value, callback = function () {
    }) {
        inst.controls[name] = new libui.UiButton();
        inst.controls[name].text = value;
        inst.controls[name].onClicked(callback);
        parent.append(inst.controls[name], 0);
    }

    static createCheckBox(inst, parent, name, value, callback = function () {
    }) {
        inst.controls[name] = new libui.UiCheckbox();
        inst.controls[name].text = name;
        inst.controls[name].setChecked(value);
        inst.controls[name].onToggled(callback);
        parent.append("", inst.controls[name], 0);
    }
}

// Config

class Configuration {

    constructor() {
        this._my_uuid = "";
        this.file = "./Oot-Rando-Coop-config.json";
        this.cfg = {};
        if (fs.existsSync(this.file)) {
            this.cfg = JSON.parse(fs.readFileSync(this.file));
        } else {
            this.cfg["SERVER"] = {};
            this.cfg.SERVER["master_server_ip"] = "192.99.70.23";
            this.cfg.SERVER["master_server_port"] = "8081";
            this.cfg.SERVER["isMaster"] = false;
            this.cfg["CLIENT"] = {};
            this.cfg.CLIENT["isTracker"] = true;
            this.cfg.CLIENT["isClient"] = true;
            this.cfg.CLIENT["nickname"] = "Player";
            this.cfg.CLIENT["game_room"] = hri.random();
            this.cfg.CLIENT["game_password"] = "";
            this.cfg.GUI = {};
            this.cfg.GUI["show_gui"] = true;
            fs.writeFileSync(this.file, JSON.stringify(this.cfg, null, 2));
        }
        this._master_server_ip = this.cfg.SERVER.master_server_ip;
        this._master_server_port = this.cfg.SERVER.master_server_port;
        this._isMaster = this.cfg.SERVER.isMaster;
        this._isTracker = this.cfg.CLIENT.isTracker;
        this._isClient = this.cfg.CLIENT.isClient;
        this._nickname = this.cfg.CLIENT.nickname;
        this._GAME_ROOM = this.cfg.CLIENT.game_room;
        this._game_password = this.cfg.CLIENT.game_password;
        this._show_gui = this.cfg.GUI.show_gui;
    }

    get game_password() {
        return this._game_password;
    }

    set game_password(value) {
        this._game_password = value;
    }

    get show_gui() {
        return this._show_gui;
    }

    set show_gui(value) {
        this._show_gui = value;
    }

    get my_uuid() {
        return this._my_uuid;
    }

    set my_uuid(value) {
        this._my_uuid = value;
    }

    get master_server_ip() {
        return this._master_server_ip;
    }

    set master_server_ip(value) {
        this._master_server_ip = value;
    }

    get master_server_port() {
        return this._master_server_port;
    }

    set master_server_port(value) {
        this._master_server_port = value;
    }

    get isMaster() {
        return this._isMaster;
    }

    set isMaster(value) {
        this._isMaster = value;
    }

    get isTracker() {
        return this._isTracker;
    }

    set isTracker(value) {
        this._isTracker = value;
    }

    get isClient() {
        return this._isClient;
    }

    set isClient(value) {
        this._isClient = value;
    }

    get nickname() {
        return this._nickname;
    }

    set nickname(value) {
        this._nickname = value;
    }

    get GAME_ROOM() {
        return this._GAME_ROOM;
    }

    set GAME_ROOM(value) {
        this._GAME_ROOM = value;
    }

    getPasswordHash() {
        return crypto.createHash('md5').update(this.game_password).digest("hex");
    }

    save() {
        this.cfg.SERVER["master_server_ip"] = this._master_server_ip;
        this.cfg.SERVER["master_server_port"] = this._master_server_port;
        this.cfg.SERVER["isMaster"] = this._isMaster;
        this.cfg.CLIENT["isTracker"] = this._isTracker;
        this.cfg.CLIENT["isClient"] = this._isClient;
        this.cfg.CLIENT["nickname"] = this._nickname;
        this.cfg.CLIENT["game_room"] = this._GAME_ROOM;
        this.cfg.CLIENT["game_password"] = this._game_password;
        fs.writeFileSync(this.file, JSON.stringify(this.cfg, null, 2));
    }
}

class MasterServer {
    constructor() {
        this._upnp_client = natUpnp.createClient();
        this._upnp_client.portMapping({
            public: CONFIG.master_server_port,
            private: CONFIG.master_server_port,
            ttl: 10
        }, function (err) {
            if (err) {
                console.log("Master: Please open port " + CONFIG.master_server_port + " on your router in order to host a game.")
            } else {
                console.log("Master: Port opened successfully!")
            }
        });

        console.log("Setting up master server...");
        CONFIG.master_server_ip = "127.0.0.1";

        this._ws_server = new IO_Server(CONFIG.master_server_port);
        this._ws_server["OotRooms"] = {};
    }

    get upnp_client() {
        return this._upnp_client;
    }

    set upnp_client(value) {
        this._upnp_client = value;
    }

    get ws_server() {
        return this._ws_server;
    }

    set ws_server(value) {
        this._ws_server = value;
    }

    setup() {
        (function (ws_server) {
            ws_server.on('connection', function (socket) {
                socket.emit('id', encodeDataForClient({id: socket.id}));
                socket.on('room_request', function (data) {

                });
                socket.on('room', function (data) {
                    let parse = decodeDataFromClient(data);
                    if (parse.room === "" || parse.room === null) {
                        parse.room = hri.random();
                    }
                    if (!ws_server.sockets.adapter.rooms.hasOwnProperty(parse.room)) {
                        console.log("Master: User claiming room " + parse.room + ".");
                        socket.join(parse.room);
                        ws_server.sockets.adapter.rooms[parse.room]["password"] = parse.password;
                        socket.emit('room_verified', encodeDataForClient({verified: true}));
                        socket.to(parse.room).emit('client_joined', encodeDataForClient({nickname: parse.nickname}));
                    } else {
                        if (ws_server.sockets.adapter.rooms[parse.room].password === parse.password) {
                            socket.join(parse.room);
                            console.log("Master: Connecting client to room: " + parse.room + ".");
                            socket.emit('room_verified', encodeDataForClient({verified: true}));
                            socket.to(parse.room).emit('client_joined', encodeDataForClient({nickname: parse.nickname}));
                        } else {
                            socket.emit('room_verified', encodeDataForClient({verified: false}));
                        }
                    }
                });
                socket.on('room_check', function (room, data) {
                    socket.to(room).emit('room_check', data);
                });
                socket.on('room_check_resp', function (room, data) {
                    let parse = decodeDataFromClient(data);
                    socket.to(parse.toClient).emit('room_check_resp', data);
                });
                socket.on('initial_sync', function (room, data) {
                    socket.to(room).emit('initial_sync', data);
                });
                socket.on('msg', function (room, data) {
                    socket.to(room).emit('msg', data);
                });
            });
        })(this._ws_server);
    }
}

class Client {
    constructor() {
        console.log("Setting up client...");
        console.log("Master Server IP: " + CONFIG.master_server_ip + ":" + CONFIG.master_server_port);
        this._websocket = new IO_Client("http://" + CONFIG.master_server_ip + ":" + CONFIG.master_server_port);
    }

    get websocket() {
        return this._websocket;
    }

    set websocket(value) {
        this._websocket = value;
    }

    setup() {
        (function (websocket, inst) {
            websocket.on('connect', function () {
                websocket.emit('room', encodeDataForClient({
                    room: CONFIG.GAME_ROOM,
                    password: CONFIG.getPasswordHash()
                }));
            });

            websocket.on('room_verified', function (data) {
                let parse = decodeDataFromClient(data);
                if (parse.verified) {
                    console.log("Client: Successfully joined room: " + CONFIG.GAME_ROOM + ".");
                    sendJustText("Connected to master server!");
                    websocket.emit('room_check', CONFIG.GAME_ROOM, encodeDataForClient({
                        uuid: CONFIG.my_uuid,
                        nickname: CONFIG.nickname
                    }));
                } else {
                    console.log("Request for room " + parse.room + " was denied due to an invalid password.");
                }
            });

            websocket.on('id', function (data) {
                let parse = decodeDataFromClient(data);
                CONFIG.my_uuid = parse.id;
                console.log("Client: My UUID: " + CONFIG.my_uuid);
            });

            websocket.on('client_joined', function (data) {
                let parse = decodeDataFromClient(data);
                sendJustText(parse.nickname + " has joined the game!");
            });

            websocket.on('room_check', function (data) {
                let parse = decodeDataFromClient(data);
                websocket.emit('room_check_resp', CONFIG.GAME_ROOM, encodeDataForClient({
                    uuid: CONFIG.my_uuid,
                    nickname: CONFIG.nickname,
                    toClient: parse.uuid
                }));
            });

            websocket.on('room_check_resp', function (data) {
                let parse = decodeDataFromClient(data);
                sendJustText("Connected player: " + parse.nickname + ".");
            });

            websocket.on('initial_sync', function (data) {
                send({message: "Sending initial data to partners...", player_connecting: true});
                if (hasPierre && data.pierre) {
                    sendJustText("Sending Pierre to new player.");
                    sendJustText("Incoming lag spike.");
                    setTimeout(function () {
                        send({message: "Querying for Pierre data...", scarecrow: true});
                    }, 30000);
                }
            });

            websocket.on('msg', function (data) {
                let parse = decodeDataFromClient(data);
                let incoming = parse.payload;
                processData(incoming, parse.uuid);
            });
        })(this._websocket, this);
    }
}

class EmuConnection {
    constructor() {
        this._emuhawk = null;
        this._packet_buffer = "";
        this._awaiting_send = [];
        this._zServer = net.createServer(function (socket) {
            console.log("Connected to BizHawk!");
            this._emuhawk = socket;
            sendJustText("Connected to node!");
            socket.setEncoding('ascii');
            socket.on('data', function (data) {
                try {
                    let dataStream = data.split("\r\n");
                    for (let i = 0; i < dataStream.length; i++) {
                        if (dataStream[i] === "") {
                            continue;
                        }
                        // This shit literally only triggers on Pierre's data because its comically huge by Oot standards.
                        if (dataStream[i].indexOf("}") === -1) {
                            // Incomplete data.
                            this._packet_buffer = dataStream[i];
                            continue;
                        } else if (dataStream[i].indexOf("{") === -1) {
                            // This must be the other half.
                            this._packet_buffer += dataStream[i];
                        } else if (dataStream[i].indexOf("{") > -1 && dataStream[i].indexOf("}") > -1) {
                            this._packet_buffer = dataStream[i];
                        } else {
                            this._packet_buffer += dataStream[i];
                            continue;
                        }
                        parseData(this._packet_buffer);
                    }
                } catch (err) {
                    if (err) {
                        console.log(err);
                        console.log("---------------------");
                        console.log("Something went wrong!");
                        console.log("---------------------");
                        console.log(packet_buffer);
                        this._packet_buffer = "";
                    }
                }
            });
        });
        if (CONFIG.isClient) {
            this._server = restify.createServer();
            this._server.name = "Oot Randomizer Co-op";
            this._server.use(restify.plugins.bodyParser());
            (function (server) {
                server.listen(process.env.port || process.env.PORT || 8082, function () {
                    console.log('%s listening to %s', server.name, server.url);
                });
            })(this._server);
            if (CONFIG.isTracker) {
                console.log("Setting up item tracker...");
                (function (server) {
                    if (fs.existsSync("./overlay/overlay.html")) {
                        server.pre(serveStatic('./overlay', {'index': ['overlay.html']}));
                    }
                    server.get('/oot/randomizer/data', function (req, res, next) {
                        res.send(OotOverlay_data);
                        next();
                    });
                })(this._server);
            }
            (function (server, awaiting_send, zServer) {
                server.get('/oot/randomizer/awaiting', function (req, res, next) {
                    res.send(awaiting_send);
                    awaiting_send.length = 0;
                    next();
                });
                zServer.listen(1337, '127.0.0.1', function () {
                    console.log("Awaiting connection. Please load the .lua script in Bizhawk.");
                });
            })(this._server, this._awaiting_send, this._zServer);
        }
    }

    get emuhawk() {
        return this._emuhawk;
    }

    set emuhawk(value) {
        this._emuhawk = value;
    }

    get packet_buffer() {
        return this._packet_buffer;
    }

    set packet_buffer(value) {
        this._packet_buffer = value;
    }

    get awaiting_send() {
        return this._awaiting_send;
    }

    set awaiting_send(value) {
        this._awaiting_send = value;
    }

    get zServer() {
        return this._zServer;
    }

    set zServer(value) {
        this._zServer = value;
    }

    get server() {
        return this._server;
    }

    set server(value) {
        this._server = value;
    }
}

const CONFIG = new Configuration();

function decodeDataFromClient(pack) {
    return JSON.parse(lzw.decode(pack));
}

function encodeDataForClient(data) {
    return lzw.encode(JSON.stringify(data));
}

let master = null;
let client = null;
let emu = null;

if (CONFIG.show_gui) {
    const gui = new GUI();
} else {
    if (CONFIG.isMaster) {
        master = new MasterServer();
        master.setup();
    }

    if (CONFIG.isClient) {
        client = new Client();
        client.setup();
    }
}

emu = new EmuConnection();

function sendDataToMaster(data) {
    client.websocket.emit('msg', CONFIG.GAME_ROOM, encodeDataForClient({
        uuid: CONFIG.my_uuid,
        nickname: CONFIG.nickname,
        payload: data
    }));
}

function sendDataToMasterOnChannel(channel, data) {
    client.websocket.emit(channel, CONFIG.GAME_ROOM, encodeDataForClient({
        uuid: CONFIG.my_uuid,
        nickname: CONFIG.nickname,
        payload: data
    }));
}

// Basic server for talking to Bizhawk.
let seed = 0;
let initial_setup_complete = false;

function processData(incoming, uuid) {
    let doesUpdate = true;
    if (incoming.hasOwnProperty("resync_me")) {
        sendJustText("Sending resync request. Please wait...");
        OotStorage = loadBaseData();
        OotOverlay_data = {};
        SceneStorage = {};
        FlagStorage = {};
        SkulltulaStorage = {};
        send({message: "Reloading gamestate...", player_connecting: true});
        setTimeout(function () {
            sendDataToMasterOnChannel('initial_sync', {player_connecting: true, pierre: !hasPierre});
        }, 5000);
        return;
    }
    if (incoming.hasOwnProperty("scene_data")) {
        if (!SceneStorage.hasOwnProperty("scene_data") || !initial_setup_complete) {
            doesUpdate = false;
        }
        updateScenes({
            addr: incoming.scene_data.addr,
            scene_data: incoming.scene_data.scene_data,
            uuid: uuid
        })
    }
    else if (incoming.hasOwnProperty("flag_data")) {
        if (!FlagStorage.hasOwnProperty("flag_data") || !initial_setup_complete) {
            doesUpdate = false;
        }
        Object.keys(incoming.flag_data).forEach(function (key) {
            updateFlags({addr: key, data: incoming.flag_data[key], uuid: uuid})
        });
    }
    else if (incoming.hasOwnProperty("skulltulas")) {
        if (!SkulltulaStorage.hasOwnProperty("skulltulas") || !initial_setup_complete) {
            doesUpdate = false;
        }
        Object.keys(incoming.skulltulas).forEach(function (key) {
            updateSkulltulas({addr: key, data: incoming.skulltulas[key], uuid: uuid})
        });
    } else if (incoming.hasOwnProperty("dungeon_items")) {
        updateDungeonItems({addr: incoming.addr, data: incoming.dungeon_items, uuid: uuid});
    } else if (incoming.hasOwnProperty("dungeon_key")) {
        // Don't send this to the server directly. We'll send a delta from the handler itself.
        updateDungeonKeyTrackers(incoming);
        doesUpdate = false;
    } else if (incoming.hasOwnProperty("dungeon_key_delta")) {
        processDungeonKeyDelta(incoming);
        doesUpdate = false;
    }
    else if (incoming.hasOwnProperty("scarecrow_data")) {
        updateScarecrow({uuid: uuid, payload: incoming});
    } else if (incoming.hasOwnProperty("bottle")) {
        if (initial_setup_complete) {
            updateInventory({uuid: uuid, data: incoming.bottle});
        } else {
            doesUpdate = false;
        }
    } else {
        if (OotStorage == null && !initial_setup_complete && uuid === CONFIG.my_uuid) {
            sendJustText("Loading initial game state...");
            OotStorage = loadBaseData();
            updateBundles({uuid: uuid, data: incoming});
            updateInventory({uuid: uuid, data: incoming});
            overlayHandler(incoming);
            setTimeout(function () {
                sendJustText("Sending sync request...");
                sendDataToMasterOnChannel('initial_sync', {player_connecting: true, pierre: false});
                initial_setup_complete = true;
            }, 10000);
            doesUpdate = false;
            return doesUpdate;
        } else {
            if (initial_setup_complete) {
                updateInventory({uuid: uuid, data: incoming});
                updateBundles({uuid: uuid, data: incoming});
                checkForGanon(incoming);
                overlayHandler(incoming);
            }
        }
    }
    return doesUpdate;
}

function loadBaseData() {
    return JSON.parse(Buffer.from("eyJjdHJhZGUiOjI1NSwiYXRyYWRlIjoyNTUsIm1hZ2ljX2xpbWl0IjowLCJsZW5zIjoyNTUsIm9jYXJpbmEiOjI1NSwic3RpY2siOjI1NSwiZndpbmQiOjI1NSwiYm9tYl9jb3VudCI6MCwibnV0c19jb3VudCI6MCwicXVlc3RfMyI6WzAsMCwwLDAsMCwwLDAsMF0sImlhcnJvdyI6MjU1LCJtYWdpY19ib29sIjowLCJza3VsbF90b2tlbnNfY291bnQiOjAsImhhbW1lciI6MjU1LCJoZWFsIjowLCJudXRzIjoyNTUsImxhcnJvdyI6MjU1LCJhcnJvd3NfY291bnQiOjAsImJvb21lcmFuZyI6MjU1LCJib21iY2h1X2NvdW50IjowLCJkZWZlbnNlIjowLCJoZWFydHMiOjQ4LCJ1cGdyYWRlc18yIjpbMCwwLDAsMCwwLDAsMCwwXSwiYmVhbl9jb3VudCI6MCwidHVuaWNzIjpbMCwwLDAsMSwwLDAsMCwxXSwibmxvdmUiOjI1NSwibWFnaWNfcG9vbCI6MCwiYm93IjoyNTUsInN0aWNrX2NvdW50IjowLCJidWxsZXRfY291bnQiOjAsImJvbWJzIjoyNTUsInNjZW5lIjo4MSwibWFnaWNfc2l6ZSI6MCwiYm9tYmNodSI6MjU1LCJ1cGdyYWRlc18xIjpbMCwwLDAsMCwwLDAsMCwwXSwiYmlnZ2Vyb25fZmxhZyI6MCwicXVlc3RfMiI6WzAsMCwwLDAsMCwwLDAsMF0sImRpbnMiOjI1NSwic2xpbmdzaG90IjoyNTUsImhvb2tzaG90IjoyNTUsInN3b3JkcyI6WzAsMCwwLDAsMCwwLDAsMF0sInF1ZXN0XzEiOlswLDAsMCwwLDAsMCwwLDBdLCJiZWFucyI6MjU1LCJ1cGdyYWRlc18zIjpbMCwwLDAsMCwwLDAsMCwwXSwiZmFycm93IjoyNTUsInBhY2tldF9pZCI6ImN1cnJlbnRfZGF0YSJ9", 'base64'));
}

function parseData(data) {
    var unpack = null;
    try {
        unpack = JSON.parse(data);
        let decode = Buffer.from(unpack.data, 'base64');
        let incoming = JSON.parse(decode);
        incoming["packet_id"] = unpack.packet_id;
        if (incoming.hasOwnProperty("seed")) {
            seed = incoming.seed;
            console.log("Randomizer seed: " + seed);
            return;
        }
        if (processData(incoming, CONFIG.my_uuid)) {
            sendDataToMaster(incoming);
        }
    } catch (err) {
        if (err) {
            console.log(err);
            console.log("---------------------");
            console.log("Something went wrong!");
            console.log("---------------------");
            console.log(data);
        }
    }
}

function send(data) {
    let json = JSON.stringify(data);
    let packet = Buffer.from(json).toString('base64');
    emu.awaiting_send.push(packet);
}

function sendJustText(text) {
    send({message: text, payload: {}});
}

let key_translations = {};

function registerKeyTranslation(key, translation) {
    key_translations[key] = translation;
}

function getKeyTranslation(key, int) {
    if (key_translations.hasOwnProperty(key)) {
        if (typeof key_translations[key] === 'function') {
            return key_translations[key](int);
        } else {
            return key_translations[key];
        }
    } else {
        return key;
    }
}

// Oot inventory and world state management.
var OotStorage = null;
let OotOverlay_data = {};
let SceneStorage = {};
let FlagStorage = {};
let SkulltulaStorage = {};
// Pierre takes up so much space he deserves his own object... lol.
let ScarecrowStorage = null;
let hasPierre = false;
let DungeonStorage = {
    items: {},
    small_keys: {}
};

let inventory_keys = ["ctrade", "atrade", "lens", "ocarina", "stick", "fwind", "bottle1", "iarrow", "farrow", "hammer", "nuts", "larrow", "boomerang", "nlove", "bow", "bottle2", "bombchu", "bombs", "bottle4", "bottle3", "dins", "slingshot", "hookshot", "beans"];
let inventory_blank = 255;
let boolean_keys = ["magic_bool", "biggeron_flag", "defense"];
let int_keys = ["hearts", "magic_size", "magic_limit"];

let tunic_targets = {green: 7, red: 6, blue: 5};

registerKeyTranslation("green", "Kokiri Tunic");
registerKeyTranslation("red", "Goron Tunic");
registerKeyTranslation("blue", "Zora Tunic");

registerKeyTranslation("ctrade", function (int) {
    switch (int) {
        case 33:
            return "Egg (Child)";
        case 34:
            return "Cucco (Child)";
        case 35:
            return "Zelda's Letter";
        case 36:
            return "Keaton Mask";
        case 37:
            return "Skull Mask";
        case 38:
            return "Spooky Mask";
        case 39:
            return "Bunny Hood";
        case 40:
            return "Goron Mask";
        case 41:
            return "Zora Mask";
        case 42:
            return "Gerudo Mask";
        case 43:
            return "Mask of Truth";
        case 44:
            return "Sold Out";
    }
});
registerKeyTranslation("atrade", function (int) {
    switch (int) {
        case 45:
            return "Egg (Adult)";
        case 46:
            return "Chicken (Adult)";
        case 47:
            return "Cojiro";
        case 48:
            return "Odd Mushroom";
        case 49:
            return "Odd Potion";
        case 50:
            return "Poacher's Saw";
        case 51:
            return "Broken Sword";
        case 52:
            return "Prescription";
        case 53:
            return "Eyeball Frog";
        case 54:
            return "Eye Drops";
        case 55:
            return "Claim Check";
    }
});
registerKeyTranslation("ocarina", "Ocarina");
registerKeyTranslation("lens", "Lens of Truth");
registerKeyTranslation("stick", "Deku Stick");
registerKeyTranslation("nuts", "Deku Nuts");
registerKeyTranslation("fwind", "Farore's Wind");

function bottleTranslation(int) {
    switch (int) {
        case 20:
            return "Empty Bottle";
        case 21:
            return "Red Potion";
        case 22:
            return "Green Potion";
        case 23:
            return "Blue Potion";
        case 24:
            return "Bottled Fairy";
        case 25:
            return "Bottled Fish";
        case 26:
            return "Bottle of Milk";
        case 31:
            return "Bottle of Milk (Half)";
        case 27:
            return "Ruto's Letter";
        case 28:
            return "Blue Fire";
        case 29:
            return "Bottled Bugs";
        case 30:
            return "Bottled Poe";
        case 32:
            return "Bottled Poe";
    }
}

registerKeyTranslation("bottle1", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("bottle2", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("bottle3", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("bottle4", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("iarrow", "Ice Arrows");
registerKeyTranslation("farrow", "Fire Arrows");
registerKeyTranslation("hammer", "Megaton Hammer");
registerKeyTranslation("larrow", "Light Arrows");
registerKeyTranslation("boomerang", "Boomerang");
registerKeyTranslation("nlove", "Nayru's Love");
registerKeyTranslation("bow", "Fairy Bow");
registerKeyTranslation("bombchu", "Bombchus");
registerKeyTranslation("bombs", "Bombs");
registerKeyTranslation("dins", "Din's Fire");
registerKeyTranslation("slingshot", "Slingshot");
registerKeyTranslation("hookshot", function (int) {
    switch (int) {
        case 10:
            return "Hookshot";
        case 11:
            return "Longshot";
    }
});
registerKeyTranslation("beans", "Magic Beans");
registerKeyTranslation("magic_bool", "Magic Meter");
registerKeyTranslation("biggeron_flag", "Biggoron's Sword");
registerKeyTranslation("defense", "Enhanced Defense");
registerKeyTranslation("hearts", "Heart Container");
registerKeyTranslation("magic_size", "Enhanced Magic Meter");
registerKeyTranslation("magic_limit", function (data) {
    switch (data) {
        case 48:
            return "Standard Magic Meter Capacity";
        case 96:
            return "Enhanced Magic Meter Capacity";
    }
});

function overlayHandler(data) {
    OotOverlay_data["skull_tokens_count"] = data["skull_tokens_count"];
}

let int_special_handlers = {};

function registerSpecialIntHandler(key, callback) {
    int_special_handlers[key] = callback;
    //console.log("Registered int handler for key " + key + ".");
}

registerSpecialIntHandler("magic_size", function (key, pack) {
    if (CONFIG.my_uuid !== pack["uuid"]) {
        let r2 = {message: "Filling up your magic...", payload: {magic_pool: 0x60}};
        send(r2);
    }
});

registerSpecialIntHandler("hearts", function (key, pack) {
    if (CONFIG.my_uuid !== pack["uuid"]) {
        let r2 = {
            message: "Filling up your health due to gaining a heart container...",
            payload: {heal: 101}
        };
        send(r2);
    }
});

function intHandler(pack) {
    let data = pack.data;
    let flag = false;
    try {
        Object.keys(int_keys).forEach(function (key) {
            let v = int_keys[key];
            if (!OotStorage.hasOwnProperty(v)) {
                OotStorage[v] = data[v];
                OotOverlay_data[v] = OotStorage[v];
            }
            if ((OotStorage[v] < data[v])) {
                flag = true;
                OotStorage[v] = data[v];
                if (CONFIG.my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(v, data[v]) + ".", payload: {}};
                    r.payload[v] = OotStorage[v];
                    send(r);
                }
                OotOverlay_data[v] = OotStorage[v];
                if (int_special_handlers.hasOwnProperty(v)) {
                    int_special_handlers[v](v, pack);
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

let bool_special_handlers = {};

function registerSpecialBoolHandler(key, callback) {
    bool_special_handlers[key] = callback;
    //console.log("Registered bool handler for key " + key + ".");
}

registerSpecialBoolHandler("magic_bool", function (key, pack) {
    if (CONFIG.my_uuid !== pack["uuid"]) {
        let r2 = {message: "Filling up your magic...", payload: {magic_pool: 0x30}};
        send(r2);
    }
});

function boolHandler(pack) {
    let flag = false;
    let data = pack.data;
    try {
        Object.keys(boolean_keys).forEach(function (key) {
            let v = boolean_keys[key];
            if ((OotStorage[v] === 0 && data[v] !== 0)) {
                flag = true;
                OotStorage[v] = data[v];
                if (CONFIG.my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(v, data[v]) + ".", payload: {}};
                    r.payload[v] = OotStorage[v];
                    send(r);
                }
                OotOverlay_data[v] = (OotStorage[v] === 1);
                if (bool_special_handlers.hasOwnProperty(v)) {
                    bool_special_handlers[v](v, pack);
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

function genericBundleHandler(pack, keyMap, storageKey) {
    let flag = false;
    let data = pack.data;
    try {
        if (!OotStorage.hasOwnProperty(storageKey)) {
            OotStorage[storageKey] = [];
        }
        Object.keys(keyMap).forEach(function (key) {
            let bit = keyMap[key];
            if ((OotStorage[storageKey][bit] === 0 && data[storageKey][bit] === 1)) {
                flag = true;
                OotStorage[storageKey][bit] = data[storageKey][bit];
                if (CONFIG.my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(key, data[storageKey][bit]) + ".", payload: {}};
                    r.payload[storageKey] = OotStorage[storageKey];
                    send(r);
                }
                if (OotStorage[storageKey][bit] === 1) {
                    console.log("Yes " + key);
                    OotOverlay_data[key] = true;
                } else {
                    console.log("No " + key);
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
            console.log(pack);
        }
    }
    return flag;
}

function tunicHandler(data) {
    return genericBundleHandler(data, tunic_targets, "tunics");
}

let boot_targets = {boots: 3, iron: 2, hover: 1};

registerKeyTranslation("boots", "Kokiri Boots");
registerKeyTranslation("iron", "Iron Boots");
registerKeyTranslation("hover", "Hover Boots");

function bootHandler(data) {
    return genericBundleHandler(data, boot_targets, "tunics");
}

let sword_targets = {kokori: 7, master: 6, giants: 5, broken: 4};

registerKeyTranslation("kokori", "Kokiri Sword");
registerKeyTranslation("master", "Master Sword");
registerKeyTranslation("giants", "Giant's Knife");
registerKeyTranslation("broken", "Broken Sword");

function swordHandler(data) {
    return genericBundleHandler(data, sword_targets, "swords");
}

let shield_targets = {deku: 3, hylian: 2, mirror: 1};

registerKeyTranslation("deku", "Deku Shield");
registerKeyTranslation("hylian", "Hylian Shield");
registerKeyTranslation("mirror", "Mirror Shield");

function shieldHandler(data) {
    return genericBundleHandler(data, shield_targets, "swords");
}

let upgrade_amount_overrides = {};

function genericUpgradeHandler(pack, targets, storageKey, payloads) {
    let flag = false;
    let data = pack.data;
    try {
        Object.keys(targets).forEach(function (key) {
            let current = [];
            let incoming = [];
            targets[key].forEach(function (value) {
                current.push(Number(OotStorage[storageKey][value]));
                incoming.push(Number(data[storageKey][value]));
            });
            let ourLevel = 0;
            let theirLevel = 0;
            Object.keys(payloads[key]).forEach(function (key2) {
                let comparison = payloads[key][key2];
                if (arrayComparison(current, comparison)) {
                    ourLevel = key2;
                }
                if (arrayComparison(comparison, incoming)) {
                    theirLevel = key2;
                }
            });
            if ((Number(theirLevel) > Number(ourLevel))) {
                let startingBit = 0;
                targets[key].forEach(function (value) {
                    OotStorage[storageKey][value] = incoming[startingBit];
                    startingBit++;
                });
                flag = true;
                console.log(key + " " + theirLevel);
                if (CONFIG.my_uuid !== pack["uuid"]) {
                    let k = key + " " + theirLevel;
                    let r = {
                        message: "Received " + getKeyTranslation(key + "_u", Number(theirLevel)) + ".",
                        payload: {}
                    };
                    r.payload[storageKey] = OotStorage[storageKey];
                    if (!upgrade_no_increase.contains(k)) {
                        r.payload[key + "_count"] = Number(theirLevel);
                        if (upgrade_amount_overrides.hasOwnProperty(key)) {
                            if (upgrade_amount_overrides[key].hasOwnProperty(theirLevel)) {
                                r.payload[key + "_count"] = Number(upgrade_amount_overrides[key][Number(theirLevel)]);
                            }
                        }
                    }
                    send(r);
                }
                if (theirLevel > 0) {
                    OotOverlay_data[key + "_upgrade"] = theirLevel;
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

let upgrade_1_targets = {nuts: [1, 2, 3], stick: [4, 5, 6]};
let upgrade_1_payloads = {
    nuts: {0: [0, 0, 0], 20: [0, 0, 1], 30: [0, 1, 0], 40: [0, 1, 1]},
    stick: {0: [0, 0, 0], 10: [0, 0, 1], 20: [0, 1, 0], 30: [0, 1, 1]}
};
let upgrade_3_targets = {strength: [0, 1, 2], bomb: [3, 4], arrows: [6, 7]};
let upgrade_3_payloads = {
    strength: {0: [0, 0, 0], 1: [0, 1, 0], 2: [1, 0, 0], 3: [1, 1, 0]},
    bomb: {0: [0, 0], 20: [0, 1], 30: [1, 0], 40: [1, 1]},
    arrows: {0: [0, 0], 30: [0, 1], 40: [1, 0], 50: [1, 1]}
};
let upgrade_2_targets = {bullet: [0, 1], wallet: [2, 3], scale: [5, 6]};
let upgrade_2_payloads = {
    bullet: {0: [0, 0], 30: [0, 1], 40: [1, 0], 50: [1, 1]},
    wallet: {99: [0, 0], 200: [0, 1], 500: [1, 0]},
    scale: {0: [0, 0], 1: [0, 1], 2: [1, 0]}
};

registerKeyTranslation("nuts_u", function (value) {
    return "Deku Nut Upgrade (" + value + ")"
});
registerKeyTranslation("stick_u", function (value) {
    return "Deku Stick Upgrade (" + value + ")";
});
registerKeyTranslation("strength_u", function (value) {
    console.log("strength_u " + value);
    switch (value) {
        case 1:
            return "Goron Braclet";
        case 2:
            return "Silver Gauntlets";
        case 3:
            return "Golden Gauntlets";
    }
});
registerKeyTranslation("bomb_u", function (value) {
    return "Bomb Bag (" + value + ")";
});
registerKeyTranslation("arrows_u", function (value) {
    return "Quiver (" + value + ")";
});
registerKeyTranslation("bullet_u", function (value) {
    return "Bullet Bag (" + value + ")";
});
registerKeyTranslation("wallet_u", function (value) {
    switch (value) {
        case 99:
            return "Wallet";
        case 200:
            return "Adult's Wallet";
        case 500:
            return "Giant's Wallet";
    }
});
registerKeyTranslation("scale_u", function (value) {
    switch (value) {
        case 1:
            return "Silver Scale";
        case 2:
            return "Golden Scale";
    }
});

upgrade_amount_overrides["stick"] = {10: 1};
upgrade_amount_overrides["nuts"] = {20: 5};

let upgrade_no_increase = [
    "stick 0", "bomb 0", "arrows 0", "bullet 0", "nuts 0"
];

function upgrade_handler(data) {
    let flag = false;
    if (genericUpgradeHandler(data, upgrade_1_targets, "upgrades_1", upgrade_1_payloads)) {
        flag = true;
    }
    if (genericUpgradeHandler(data, upgrade_2_targets, "upgrades_2", upgrade_2_payloads)) {
        flag = true;
    }
    if (genericUpgradeHandler(data, upgrade_3_targets, "upgrades_3", upgrade_3_payloads)) {
        flag = true;
    }
    return flag;
}

let quest_1_targets = {
    song_of_time: 7,
    song_of_storms: 6,
    emerald: 5,
    ruby: 4,
    sapphire: 3,
    stone: 2,
    card: 1,
    skulltula_flag: 0
};
let quest_2_targets = {serenade: 7, requiem: 6, nocturn: 5, prelude: 4, lullaby: 3, epona: 2, saria: 1, sun: 0};
let quest_3_targets = {forest: 7, fire: 6, water: 5, spirit: 4, shadow: 3, light: 2, minuet: 1, bolero: 0};

registerKeyTranslation("song_of_time", "Song of Time");
registerKeyTranslation("song_of_storms", "Song of Storms");
registerKeyTranslation("emerald", "Kokiri Emerald");
registerKeyTranslation("ruby", "Goron Ruby");
registerKeyTranslation("sapphire", "Zora's Sapphire");
registerKeyTranslation("stone", "Stone of Agony");
registerKeyTranslation("card", "Gerudo Membership Card");
registerKeyTranslation("skulltula_flag", "Skulltulas");
registerKeyTranslation("serenade", "Serenade of Water");
registerKeyTranslation("requiem", "Requiem of Spirit");
registerKeyTranslation("nocturn", "Nocturn of Shadow");
registerKeyTranslation("prelude", "Prelude of Light");
registerKeyTranslation("lullaby", "Zelda's Lullaby");
registerKeyTranslation("epona", "Epona's Song");
registerKeyTranslation("saria", "Saria's Song");
registerKeyTranslation("sun", "Sun's Song");
registerKeyTranslation("forest", "Forest Medallion");
registerKeyTranslation("fire", "Fire Medallion");
registerKeyTranslation("water", "Water Medallion");
registerKeyTranslation("spirit", "Spirit Medallion");
registerKeyTranslation("shadow", "Shadow Medallion");
registerKeyTranslation("light", "Light Medallion");
registerKeyTranslation("minuet", "Minuet of the Forest");
registerKeyTranslation("bolero", "Bolero of Fire");

function quest_handler(data) {
    let flag = false;
    if (genericBundleHandler(data, quest_1_targets, "quest_1")) {
        flag = true;
    }
    if (genericBundleHandler(data, quest_2_targets, "quest_2")) {
        flag = true;
    }
    if (genericBundleHandler(data, quest_3_targets, "quest_3")) {
        flag = true;
    }
    return flag;
}

let inventory_special_handlers = {};

function registerInventoryHandler(key, callback) {
    inventory_special_handlers[key] = callback;
    //console.log("Registered inventory handler for key " + key + ".");
}

registerInventoryHandler("basic_handler", function (key, value, data) {
    if (value === inventory_blank && data[key] !== inventory_blank) {
        return true;
    }
    return value !== inventory_blank && (data[key] > value && data[key] !== inventory_blank);
});

let child_trade_status = 0;

registerInventoryHandler("ctrade", function (key, value, data) {
    if (value === inventory_blank) {
        child_trade_status = data[key];
        return inventory_special_handlers["basic_handler"](key, value, data);
    } else {
        if (child_trade_status === 0) {
            child_trade_status = OotStorage[key];
            console.log("Child trade quest set to " + child_trade_status + ".");
        }
        if (value !== inventory_blank && data[key] > value && child_trade_status < data[key] && data[key] !== inventory_blank) {
            if (data[key] !== 44) {
                // mask is newer but not sold out.
                child_trade_status = data[key];
                console.log("Child trade quest advanced to " + child_trade_status + ".");
                return true;
            }
        }
    }
    return false;
});

function bottleHandler(key, value, data) {
    if (value === inventory_blank) {
        return inventory_special_handlers["basic_handler"](key, value, data);
    }
    return value !== inventory_blank && value !== data[key] && data[key] !== inventory_blank;
}

registerInventoryHandler("bottle1", bottleHandler);
registerInventoryHandler("bottle2", bottleHandler);
registerInventoryHandler("bottle3", bottleHandler);
registerInventoryHandler("bottle4", bottleHandler);

let inventory_amount_handlers = {};

function registerInventoryAmountHandler(key, callback) {
    inventory_amount_handlers[key] = callback;
    //console.log("Registered inventory # handler for key " + key + ".");
}

registerInventoryAmountHandler("bombchu", function () {
    return 10;
});

function updateInventory(pack) {
    let data = pack.data;
    try {
        Object.keys(data).forEach(function (k) {
            // The idea here is the client can send incomplete inventory updates when necessary.
            // Check the incoming packet against the valid inventory array. If indexOf is -1 the data is useless and should be discarded.
            // This can happen when something changes that we know about but don't necessarily care about right now like bomb count.
            let key = inventory_keys.indexOf(k);
            if (key === -1) {
                // return is more or less 'continue' when in JS foreach loops...
                return;
            }
            if (!OotStorage.hasOwnProperty(inventory_keys[key])) {
                OotStorage[inventory_keys[key]] = data[inventory_keys[key]];
                console.log("Setting value for inventory key: " + inventory_keys[key] + ".");
                OotOverlay_data[inventory_keys[key]] = data[inventory_keys[key]];
            }
            let val = OotStorage[inventory_keys[key]];
            let handler = "basic_handler";
            if (inventory_special_handlers.hasOwnProperty(inventory_keys[key])) {
                handler = inventory_keys[key];
            }
            if (inventory_special_handlers[handler](inventory_keys[key], val, data)) {
                OotStorage[inventory_keys[key]] = data[inventory_keys[key]];
                val = OotStorage[inventory_keys[key]];
                if (CONFIG.my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(inventory_keys[key], val) + ".", payload: {}};
                    r.payload[inventory_keys[key]] = data[inventory_keys[key]];
                    if (inventory_amount_handlers.hasOwnProperty(inventory_keys[key])) {
                        r.payload[inventory_keys[key] + "_count"] = inventory_amount_handlers[inventory_keys[key]]();
                    }
                    send(r);
                }
                if (OotStorage[inventory_keys[key]] !== 255) {
                    OotOverlay_data[inventory_keys[key]] = data[inventory_keys[key]];
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
}

function updateBundles(data) {
    tunicHandler(data);
    bootHandler(data);
    swordHandler(data);
    shieldHandler(data);
    upgrade_handler(data);
    quest_handler(data);
    boolHandler(data);
    intHandler(data);
}

// Thanks to Delph for having the patience to sort these out.
let scene_translations = {
    "0x11AB04": "Mido's House",
    "0x11A6A4": "Great Deku Tree",
    "0x11AB90": "Kokiri Shop",
    "0x11AEF4": "Lon Lon Ranch",
    "0x11AFF0": "Kokiri Forest",
    "0x11B00C": "Sacred Forest Meadow",
    "0x11B07C": "Gerudo Valley",
    "0x11B108": "Hyrule Castle (Child)",
    "0x11A730": "Water Temple",
    "0x11A768": "Shadow Temple",
    "0x11A6DC": "Jabu Jabu",
    "0x11A6C0": "Dodongo's Cavern",
    "0x11A6F8": "Forest Temple",
    "0x11A714": "Fire Temple",
    "0x11B124": "Death Mountain Trail",
    "0x11AD6C": "Grotto",
    "0x11B15C": "Goron City",
    "0x11A74C": "Spirit Temple",
    "0x11B0B4": "Desert Colossus",
    "0x11A784": "Bottom of the Well",
    "0x11A7A0": "Ice Cavern",
    "0x11B060": "Zora's Fountain",
    "0x11A7BC": "Gerudo Training Grounds",
    "0x11A7D8": "Gerudo Fortress",
    "0x11B0EC": "Haunted Wasteland",
    "0x11A7F4": "Thieves' Hideout",
    "0x11AFB8": "Graveyard",
    "0x11B194": "Ganon's Castle Exterior",
    "0x11A810": "Ganon's Castle",
    "0x11B140": "Death Mountain Crater",
    "0x11B044": "Zora's Domain",
    "0x11AF80": "Hyrule Field",
    "0x11AEBC": "Zelda's Courtyard",
    "0x11ADC0": "Royal Family's Tomb",
    "0x11ACA8": "Impa's House"
};

function getSceneTranslation(addr) {
    if (scene_translations.hasOwnProperty(addr)) {
        return scene_translations[addr]
    } else {
        return addr;
    }
}

function updateScenes(data) {
    if (!SceneStorage.hasOwnProperty("scene_data")) {
        SceneStorage["scene_data"] = {};
        console.log("Creating scene data table.")
    }
    if (!SceneStorage["scene_data"].hasOwnProperty(data.addr)) {
        SceneStorage["scene_data"][data.addr] = data.scene_data;
        console.log("Writing initial scene data for address " + data.addr + ".");
        return false;
    }
    let flag = false;
    let list = [];
    try {
        Object.keys(SceneStorage["scene_data"][data.addr]).forEach(function (k2) {
            for (let i = 0; i < SceneStorage["scene_data"][data.addr][k2].length; i++) {
                if (SceneStorage["scene_data"][data.addr][k2][i] === 0 && data["scene_data"][k2][i] === 1) {
                    SceneStorage["scene_data"][data.addr][k2][i] = data["scene_data"][k2][i];
                    flag = true;
                    list.push(k2 + " | " + i);
                }
            }
        });
        if (flag) {
            let r = {
                message: "Received scene update: " + getSceneTranslation(data.addr),
                addr: data.addr,
                scene_data: {}
            };
            if (CONFIG.my_uuid !== data["uuid"]) {
                r["scene_data"] = SceneStorage["scene_data"][data.addr];
                send(r);
            }
            console.log("Scene Update required! " + data.addr);
            for (let i = 0; i < list.length; i++) {
                //sendJustText(list[i]);
                console.log(list[i]);
            }
        }
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

function updateSkulltulas(s) {
    if (!SkulltulaStorage.hasOwnProperty("skulltulas")) {
        SkulltulaStorage["skulltulas"] = {};
        SkulltulaStorage["skull_tokens_count"] = 0;
        console.log("Creating skulltula storage table...")
    }
    if (!SkulltulaStorage.skulltulas.hasOwnProperty(s.addr)) {
        SkulltulaStorage.skulltulas[s.addr] = s.data;
        console.log("Writing initial skulltula data for address " + s.addr + ".");
        return false;
    }
    let list = [];
    let update_required = false;
    try {
        for (let i = 0; i < SkulltulaStorage.skulltulas[s.addr].length; i++) {
            if (SkulltulaStorage.skulltulas[s.addr][i] === 0 && s.data[i] === 1) {
                SkulltulaStorage.skulltulas[s.addr][i] = s.data[i];
                update_required = true;
                list.push(s.addr + " | " + i);
            }
        }
        if (update_required) {
            // This is dupe prevention. Should a player dupe a skulltula by standing in the same room as their partner their balance will be corrected as soon as they pass through a loading zone.
            // Skulltula destruction is stored in one byte per scene. Count the bits that are 1 to get the true Skulltula count.
            let scount = 0;
            Object.keys(SkulltulaStorage.skulltulas).forEach(function (addr) {
                for (let i = 0; i < SkulltulaStorage.skulltulas[addr].length; i++) {
                    if (SkulltulaStorage.skulltulas[addr][i] === 1) {
                        scount++;
                    }
                }
            });
            if (scount > SkulltulaStorage.skull_tokens_count) {
                console.log("New Skulltula count: " + scount);
                SkulltulaStorage.skull_tokens_count = scount;
            } else {
                scount = SkulltulaStorage.skull_tokens_count;
            }
            if (CONFIG.my_uuid !== s["uuid"]) {
                let r = {
                    message: "New Skulltula Count: " + scount,
                    addr: s.addr,
                    skulltulas: {},
                    skull_tokens_count: scount
                };
                r["skulltulas"] = SkulltulaStorage["skulltulas"][s.addr];
                send(r);
            }
            console.log("Skulltula Update required! " + s.addr);
            for (let k = 0; k < list.length; k++) {
                //sendJustText(list[k]);
                console.log(list[k]);
            }
        }
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return update_required;
}

let flag_event_triggers = {};

function createFlagEventTrigger(addr, callback) {
    flag_event_triggers[addr] = callback;
    //console.log("Creating flag event trigger for address " + addr + ".");
}

createFlagEventTrigger("0x11b4b6", function (data) {
    // This is the flag when a player talks to Pierre as adult after having talked to him as child.
    if (data.data[3] === 1) {
        if (data["uuid"] === CONFIG.my_uuid) {
            sendJustText("Scarecrow's song detected.");
            sendJustText("Incoming lag spike.");
            setTimeout(function () {
                send({message: "Querying for Pierre data...", scarecrow: true});
            }, 30000);
            hasPierre = true;
        }
    }
});

createFlagEventTrigger("0x11b4a6", function (data) {
    // This is Epona.
    if (data.data[7] === 1) {
        if (data["uuid"] !== CONFIG.my_uuid) {
            sendJustText("Your partner acquired Epona.");
            sendJustText("If she won't come when you play the song...");
            sendJustText("... enter and exit Lon Lon Ranch.")
        } else {
            sendJustText("Epona acquired.");
        }
    }
});

function updateScarecrow(data) {
    try {
        if (ScarecrowStorage === null && !hasPierre) {
            ScarecrowStorage = {};
            ScarecrowStorage = data.payload.scarecrow_data;
            if (data["uuid"] !== CONFIG.my_uuid) {
                sendJustText("Scarecrow's song detected.");
                sendJustText("Incoming lag spike.");
                setTimeout(function () {
                    send({message: "Updating Pierre data...", pierre: ScarecrowStorage});
                    sendJustText("Save warp required to enable Pierre.");
                    sendJustText("Playing the song before save warping...");
                    sendJustText("... will result in a softlock!");
                    hasPierre = true;
                }, 30000);
            }
        }
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
}

function updateFlags(flag) {
    if (!FlagStorage.hasOwnProperty("flag_data")) {
        FlagStorage["flag_data"] = {};
        console.log("Creating flag data table...");
    }
    if (!FlagStorage.flag_data.hasOwnProperty(flag.addr)) {
        FlagStorage["flag_data"][flag.addr] = flag.data;
        console.log("Writing initial flag data for address " + flag.addr + ".");
        return false;
    }
    let list = [];
    let update_required = false;
    try {
        for (let i = 0; i < FlagStorage["flag_data"][flag.addr].length; i++) {
            if (FlagStorage["flag_data"][flag.addr][i] === 0 && flag.data[i] === 1) {
                FlagStorage["flag_data"][flag.addr][i] = flag.data[i];
                update_required = true;
                list.push(flag.addr + " | " + i);
            }
        }
        if (update_required) {
            if (CONFIG.my_uuid !== flag["uuid"]) {
                let r = {message: "Flag update received: " + flag.addr + ".", addr: flag.addr, flag_data: {}};
                r["flag_data"] = FlagStorage["flag_data"][flag.addr];
                send(r);
            }
            console.log("Flag Update required! " + flag.addr);
            for (let k = 0; k < list.length; k++) {
                //sendJustText(list[k]);
                console.log(list[k]);
            }
            if (flag_event_triggers.hasOwnProperty(flag.addr)) {
                flag_event_triggers[flag.addr](flag);
            }
        }
    } catch (err) {
        console.log(err);
    }
    return update_required;
}

let dungeon_names = {};

function registerDungeonName(addr, name) {
    dungeon_names[addr] = name;
}

function getDungeonName(addr) {
    if (dungeon_names.hasOwnProperty(addr)) {
        return dungeon_names[addr];
    }
    return addr;
}

// Map, Compass, Boss Key
registerDungeonName("0x11A678", "Great Deku Tree");
registerDungeonName("0x11A679", "Dodongo's Cavern");
registerDungeonName("0x11A67A", "Jabu Jabu");
registerDungeonName("0x11A67B", "Forest Temple");
registerDungeonName("0x11A67C", "Fire Temple");
registerDungeonName("0x11A67D", "Water Temple");
registerDungeonName("0x11A67E", "Spirit Temple");
registerDungeonName("0x11A67F", "Shadow Temple");
registerDungeonName("0x11A680", "Bottom of the Well");
registerDungeonName("0x11A681", "Ice Cavern");
registerDungeonName("0x11A682", "Ganon's Tower");
registerDungeonName("0x11A683", "Gerudo Training Grounds");
registerDungeonName("0x11A684", "Ganon's Castle");
registerDungeonName("0x11A685", "Ganon's Tower Collapse");

let dungeon_item_names = {};

function registerDungeonItemName(bit, name) {
    dungeon_item_names[bit.toString()] = name;
}

function getDungeonItemName(bit) {
    let b = bit.toString();
    if (dungeon_item_names.hasOwnProperty(b)) {
        return dungeon_item_names[b];
    }
    return b;
}

registerDungeonItemName(5, "Map");
registerDungeonItemName(6, "Compass");
registerDungeonItemName(7, "Boss Key");

function updateDungeonItems(d) {
    if (!DungeonStorage.items.hasOwnProperty(d.addr)) {
        DungeonStorage.items[d.addr] = d.data;
        console.log("Writing initial dungeon item data for address " + d.addr);
    }
    let list = [];
    let update_required = false;
    let message = "";
    message += getDungeonName(d.addr);
    message += " ";
    try {
        for (let i = 0; i < DungeonStorage.items[d.addr].length; i++) {
            if (DungeonStorage.items[d.addr][i] === 0 && d.data[i] === 1) {
                DungeonStorage.items[d.addr][i] = d.data[i];
                update_required = true;
                list.push(d.addr + " | " + i);
                message += getDungeonItemName(i);
            }
        }
        if (update_required) {
            if (CONFIG.my_uuid !== d["uuid"]) {
                let r = {message: message, addr: d.addr, dungeon_items: {}};
                r["dungeon_items"] = DungeonStorage.items[d.addr];
                send(r);
            }
            console.log("Dungeon Update required! " + d.addr);
            for (let k = 0; k < list.length; k++) {
                //sendJustText(list[k]);
                console.log(list[k]);
            }
        }
    } catch (err) {
        console.log(err);
    }
    return update_required;
}

// Small Keys
registerDungeonName("0x11A68C", "Great Deku Tree");
registerDungeonName("0x11A68D", "Dodongo's Cavern");
registerDungeonName("0x11A68E", "Jabu Jabu");
registerDungeonName("0x11A68F", "Forest Temple");
registerDungeonName("0x11A690", "Fire Temple");
registerDungeonName("0x11A691", "Water Temple");
registerDungeonName("0x11A692", "Spirit Temple");
registerDungeonName("0x11A693", "Shadow Temple");
registerDungeonName("0x11A694", "Bottom of the Well");
registerDungeonName("0x11A695", "Ice Cavern");
registerDungeonName("0x11A696", "Ganon's Tower");
registerDungeonName("0x11A697", "Gerudo Training Grounds");
registerDungeonName("0x11A699", "Ganon's Castle");
registerDungeonName("0x11A69A", "Ganon's Tower Collapse");

class DungeonSmallKeyTracker {
    constructor() {
        this._keyCount = 0;
    }

    get keyCount() {
        return this._keyCount;
    }

    set keyCount(value) {
        this._keyCount = value;
        console.log("Keys are now " + this._keyCount);
    }

    getDelta(int) {
        let diff = Math.abs(this.keyCount - int);
        if (this.keyCount > int) {
            diff /= -1;
        }
        this.keyCount += diff;
        return diff;
    }
}

let DungeonKeyTrackers = {};

function updateDungeonKeyTrackers(update) {
    // 255 is 0 in the Zelda64 engine.
    if (update.dungeon_key_payload === 255) {
        return;
    }
    if (!DungeonKeyTrackers.hasOwnProperty(update.addr)) {
        DungeonKeyTrackers[update.addr] = new DungeonSmallKeyTracker();
        console.log("Creating dungeon small key tracker for address " + update.addr + ".");
    }
    let delta = DungeonKeyTrackers[update.addr].getDelta(update.dungeon_key_payload);
    let msg = getDungeonName(update.addr) + " small key ";
    if (delta > 0) {
        msg += "+";
    }
    msg += delta.toString();
    if (delta !== 0) {
        sendDataToMaster({message: msg, dungeon_key_delta: delta, addr: update.addr});
    }
}

function processDungeonKeyDelta(update) {
    if (!DungeonKeyTrackers.hasOwnProperty(update.addr)) {
        DungeonKeyTrackers[update.addr] = new DungeonSmallKeyTracker();
        console.log("Creating dungeon small key tracker for address " + update.addr + ".");
    }
    DungeonKeyTrackers[update.addr].keyCount += update.dungeon_key_delta;
    send(update);
}

let seen_ganon_message = false;

function checkForGanon(d) {
    if (d.scene === 25 && (CONFIG.my_uuid !== d.uuid) && !seen_ganon_message) {
        sendJustText("An ally has engaged Ganon!");
        send({message: "Press Dpad Left to join them!", ganon: true});
        seen_ganon_message = true;
    }
}

// Generic helpers

function writeSave(f) {
    fs.writeFile(f, JSON.stringify(OotStorage), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}

function is(a, b) {
    return a === b && (a !== 0 || 1 / a === 1 / b) // false for +0 vs -0
        || a !== a && b !== b; // true for NaN vs NaN
}

Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

function arrayComparison(arr1, arr2) {
    if (arr1.length === arr2.length
        && arr1.every(function (u, i) {
            // Use "is" instead of "==="
            return is(u, arr2[i]);
        })
    ) {
        return true;
    } else {
        return false;
    }
}