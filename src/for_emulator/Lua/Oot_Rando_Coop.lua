--[[Copyright 2018 Mathew Miller (denoflions)

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.]]

local VERSION = "@major@.@minor@.@buildNumber@";

function connectToNode()
    -- Need to send random garbage to the socket in order for Bizhawk to initalize the connection.
    -- ¯\_(ツ)_/¯
    console.writeline("Connecting...");
    comm.socketServerSetTimeout(0);
    comm.socketServerSend("Wake up!");
    comm.socketServerResponse();
    return true;
end

packet_cache = {};
do_on_next_frame_check = {};

function sendPacket(id, data)
    local d = json.encode(data);
    if (packet_cache[id] ~= nil) then
        if (packet_cache[id] == d) then
            return;
        end
    end
    local base = to_base64(d);
    comm.socketServerSend(json.encode({ packet_id = id, data = base }) .. "\r\n");
    packet_cache[id] = d;
end

memory.usememorydomain("RDRAM");

memory_lookup = {};

-- Utility stuff
main_menu = 0x11A5D2;
pause_menu_is_open = 0x1D8DD5;
link_instance = 0x1DAA30;
link_flags_offset = 0x066C;

-- Misc stuff
memory_lookup.magic_bool = 0x11A60A;
-- This address isn't the one listed in the memory maps, but it actually does work so long as you save-warp after setting it.
memory_lookup.magic_size = 0x11A60C;
memory_lookup.magic_pool = 0x11A603;
memory_lookup.magic_limit = 0x11B9C4;

-- inventory
memory_lookup.stick = 0x11A644;
memory_lookup.nuts = 0x11A645;
memory_lookup.bombs = 0x11A646;
memory_lookup.bow = 0x11A647;
memory_lookup.farrow = 0x11A648;
memory_lookup.dins = 0x11A649;
memory_lookup.slingshot = 0x11A64A;
memory_lookup.ocarina = 0x11A64B;
memory_lookup.bombchu = 0x11A64C;
memory_lookup.hookshot = 0x11A64D;
memory_lookup.iarrow = 0x11A64E;
memory_lookup.fwind = 0x11A64F;
memory_lookup.boomerang = 0x11A650;
memory_lookup.lens = 0x11A651;
memory_lookup.beans = 0x11A652;
memory_lookup.hammer = 0x11A653;
memory_lookup.larrow = 0x11A654;
memory_lookup.nlove = 0x11A655;
memory_lookup.atrade = 0x11A65A;
memory_lookup.ctrade = 0x11A65B;
memory_lookup.bottle_1 = 0x11A656;
memory_lookup.bottle_2 = 0x11A657;
memory_lookup.bottle_3 = 0x11A658;
memory_lookup.bottle_4 = 0x11A659;

-- inventory counts
memory_lookup.stick_count = 0x11A65C;
memory_lookup.bomb_count = 0x11A65E;
memory_lookup.arrows_count = 0x11A65F;
memory_lookup.bullet_count = 0x11A662;
memory_lookup.nuts_count = 0x11A65D;
memory_lookup.bombchu_count = 0x11A664;
memory_lookup.bean_count = 0x11A66A;

-- equips
memory_lookup.tunics = 0x11A66C;
memory_lookup.swords = 0x11A66D;
memory_lookup.biggeron_flag = 0x11A60E;

-- upgrades
memory_lookup.upgrades_1 = 0x11A671;
memory_lookup.upgrades_2 = 0x11A672;
memory_lookup.upgrades_3 = 0x11A673;
memory_lookup.hearts = 0x11A5FE;
-- This address triggers the 'heal the player to full' function if you write 101 to it for some reason.
-- I stole this from a gameshark code on some random website that looked like it was originally hosted on geocities straight out of 2001.
memory_lookup.heal = 0x11B9F4;
memory_lookup.defense = 0x11A69F;

-- quest shit
memory_lookup.quest_1 = 0x11A675;
memory_lookup.quest_2 = 0x11A676;
memory_lookup.quest_3 = 0x11A677;
memory_lookup.skull_tokens_count = 0x11A6A1;
memory_lookup.beans_bought = 0x11A66B;
memory_lookup.poe_score = 0x11B48E;

special_handlers = {};
read_handlers = {};
write_handlers = {};

current_data = {};

function toBits(num, bits)
    -- returns a table of bits, most significant first.
    bits = bits or math.max(1, select(2, math.frexp(num)))
    local t = {} -- will contain the bits
    for b = bits, 1, -1 do
        t[b] = math.fmod(num, 2)
        num = math.floor((num - t[b]) / 2)
    end
    return t
end

function fromBits(b)
    local binary = tonumber(table.concat(b));
    if (binary == nil) then
        return 0;
    end
    local bin = string.reverse(binary)
    local sum = 0

    for i = 1, string.len(bin) do
        num = string.sub(bin, i, i) == "1" and 1 or 0
        sum = sum + num * math.pow(2, i - 1)
    end
    return sum;
end

function split(str)
    local lines = {}
    for s in str:gmatch("[^\r\n]+") do
        table.insert(lines, s)
    end
    return lines;
end

function readTwoByteUnsigned(addr)
    return memory.read_u16_be(addr);
end

function writeTwoByteUnsigned(addr, value)
    memory.write_u16_be(addr, value);
end

function readByte(addr)
    return memory.readbyte(addr);
end

byte_write_callbacks = {};

function writeByte(addr, value)
    memory.writebyte(addr, value);
    for k, v in pairs(byte_write_callbacks) do
        v();
    end
end

function basicItemSync(item, data)
    current_data[item] = data;
end

function inventoryBundleSync(bundle, data)
    local binary = toBits(data, 8);
    current_data[bundle] = binary;
end

function basicReadHandler(lookup)
    local d = readByte(memory_lookup[lookup]);
    return d;
end

function twoByteReadHandler(lookup)
    local d = readTwoByteUnsigned(memory_lookup[lookup]);
    return d;
end

function basicWriteHandler(lookup, data)
    writeByte(memory_lookup[lookup], data);
end

function twoByteWriteHandler(lookup, data)
    writeTwoByteUnsigned(memory_lookup[lookup], data);
end

function bundleWriteHandler(lookup, data)
    writeByte(memory_lookup[lookup], fromBits(data));
end

function bundleWriteHandlerEquipment(lookup, data)
    local binary_compare = toBits(readByte(memory_lookup[lookup]), 8);
    for k, v in pairs(binary_compare) do
        if (v == 1 and data[k] == 0) then
            -- Rewrite the bit to ensure no reversions due to frame timing...
            data[k] = v;
        end
    end
    writeByte(memory_lookup[lookup], fromBits(data));
end

function magicWriteHandler(lookup, data)
    basicWriteHandler(lookup, data);
    table.insert(do_on_next_frame_check, function()
        if (basicReadHandler(lookup) ~= data) then
            basicWriteHandler(lookup, data);
            return false;
        end
        return true;
    end);
end

for k, v in pairs(memory_lookup) do
    --console.writeline("Memory Handler: " .. k);
    special_handlers[k] = basicItemSync;
    read_handlers[k] = basicReadHandler;
    write_handlers[k] = basicWriteHandler;
end

special_handlers["tunics"] = inventoryBundleSync;
special_handlers["swords"] = inventoryBundleSync;
special_handlers["upgrades_1"] = inventoryBundleSync;
special_handlers["upgrades_2"] = inventoryBundleSync;
special_handlers["upgrades_3"] = inventoryBundleSync;
special_handlers["quest_1"] = inventoryBundleSync;
special_handlers["quest_2"] = inventoryBundleSync;
special_handlers["quest_3"] = inventoryBundleSync;

read_handlers["hearts"] = twoByteReadHandler;
read_handlers["time_of_day"] = twoByteReadHandler;
read_handlers["rupee_count"] = twoByteReadHandler;
read_handlers["heal"] = twoByteReadHandler;
read_handlers["magic_limit"] = twoByteReadHandler;
read_handlers["poe_score"] = twoByteReadHandler;

write_handlers["hearts"] = twoByteWriteHandler;
write_handlers["time_of_day"] = twoByteWriteHandler;
write_handlers["rupee_count"] = twoByteWriteHandler;
write_handlers["heal"] = twoByteWriteHandler;
write_handlers["magic_limit"] = twoByteWriteHandler;
write_handlers["poe_score"] = twoByteWriteHandler;

write_handlers["tunics"] = bundleWriteHandlerEquipment;
write_handlers["swords"] = bundleWriteHandlerEquipment;
write_handlers["upgrades_1"] = bundleWriteHandler;
write_handlers["upgrades_2"] = bundleWriteHandler;
write_handlers["upgrades_3"] = bundleWriteHandler;
write_handlers["quest_1"] = bundleWriteHandlerEquipment;
write_handlers["quest_2"] = bundleWriteHandlerEquipment;
write_handlers["quest_3"] = bundleWriteHandlerEquipment;

write_handlers["magic_pool"] = magicWriteHandler;

function runDataFunction(lookup)
    local d = read_handlers[lookup](lookup);
    special_handlers[lookup](lookup, d);
end

current_scene = 0;

function readScene()
    current_scene = readByte(0x1C8545);
    if (current_scene == 25) then
        sendPacket("scene", { scene = current_scene });
    end
end


function DEC_HEX(IN)
    local B, K, OUT, I, D = 16, "0123456789ABCDEF", "", 0
    while IN > 0 do
        I = I + 1
        IN, D = math.floor(IN / B), math.mod(IN, B) + 1
        OUT = string.sub(K, D, D) .. OUT
    end
    if (OUT == "") then
        OUT = "0";
    end
    return "0x" .. OUT
end

function serializeDump(base, d)
    local save_me = {};
    for k, v in pairs(d) do
        save_me[DEC_HEX(base + k)] = toBits(v, 8);
    end
    return save_me
end

c_buttons = 0x11A638;
c_buttons_indexes = {
    C_Left = c_buttons + 0x01,
    C_Down = c_buttons + 0x02,
    C_Right = c_buttons + 0x03
};
c_buttons_offsets = {
    C_Left = c_buttons_indexes.C_Left + 0x03,
    C_Down = c_buttons_indexes.C_Down + 0x03,
    C_Right = c_buttons_indexes.C_Right + 0x03
};

c_buttons_banned_slots = {};
c_buttons_banned_slots[3] = true;

function cButtonVerify()
    local data = {};
    data["c_buttons"] = {};
    for k, v in pairs(c_buttons_indexes) do
        data["c_buttons"][k] = readByte(v);
    end
    data["c_offsets"] = {};
    data["inv_slot"] = {};
    for k, v in pairs(c_buttons_offsets) do
        data["c_offsets"][k] = readByte(v);
        data["inv_slot"][k] = readByte(memory_lookup.stick + data["c_offsets"][k]);
        if (data["inv_slot"][k] ~= data["c_buttons"][k]) then
            -- Need to update C button.
            -- This check is necessary to ensure we don't write garbage to the C buttons...
            if (data["c_buttons"][k] ~= 255) then
                -- Check for banned slots.
                if (c_buttons_banned_slots[data["c_offsets"][k]] == nil) then
                    writeByte(c_buttons_indexes[k], data["inv_slot"][k]);
                end
            end
        end
    end
end

table.insert(byte_write_callbacks, cButtonVerify);

function updateDataFromRAM()
    for k, v in pairs(memory_lookup) do
        special_handlers[k](k, read_handlers[k](k));
    end
end

function checkForMenu()
    if (readByte(pause_menu_is_open) == 6) then
        return true;
    end
    return false;
end

function checkForOverworld()
    if (readByte(pause_menu_is_open) == 0) then
        return true;
    end
    return false;
end

function writeFile(out, data)
    j = json.encode(data);
    local file = io.open(out, "w")
    file:write(j);
    file:close()
end

function writeFileRaw(out, data)
    local file = io.open(out, "w")
    file:write(data);
    file:close()
end

function readAll(file)
    local f = assert(io.open(file, "rb"))
    local content = f:read("*all")
    f:close()
    return json.decode(content)
end

save_context = 0x11A5D0;
save_size = 0x1450;

-- ============
-- Debug stuff
-- ============
button_activator = 0x1C84B4;
Z_button = 0x0020;

-- Use this if you need to poke at some specific thing on demand for testing.
function isZ()
    return readByte(button_activator) == Z_button;
end

function dumpSaveFile()
    local save = memory.readbyterange(save_context, save_size);
    local save_me = serializeDump(0, save);
    writeFile("save_file.json", save_me);
end

-- ========

scene_data = {};
flag_data = {};
skulltula_data = {};

-- TBD: Get the scene number for each area and perform a check against the area you're in. That way we're only updating an area we could have changed something.
function dumpScenes()
    for k, v in pairs(scenes) do
        local p = {};
        local addr = tonumber(v);
        local memdump = memory.readbyterange(addr, scene_size);
        p.addr = DEC_HEX(addr);
        p.scene_data = serializeDump(addr, memdump);
        sendPacket("scene_" .. v, { scene_data = p });
    end
end

-- Why does Pierre take up so much goddamn memory? Holy crap.
scarecrow_offsets = {
    scarecrow_offset_1 = {
        offset = 0x0F40,
        size = 0x0364
    },
    scarecrow_offset_2 = {
        offset = 0x12C4,
        size = 0x0080
    },
    scarecrow_offset_3 = {
        offset = 0x1344,
        size = 0x0004
    }
};

function dumpScarecrow()
    local sc_Data = {};
    for k, v in pairs(scarecrow_offsets) do
        local addr = save_context + v.offset;
        local memdump = memory.readbyterange(addr, v.size);
        sc_Data[k] = serializeDump(addr, memdump);
    end
    sendPacket("scarecrow", { scarecrow_data = sc_Data });
end

function writeScarecrow(data)
    for k, v in pairs(data.pierre) do
        for j, k in pairs(v) do
            writeByte(tonumber(j), fromBits(k));
        end
    end
end

function dumpFlags()
    for k, v in pairs(flags_1) do
        local f = {};
        local addr = tonumber(v);
        local memdump = readByte(addr);
        f[v] = toBits(memdump, 8);
        sendPacket("flag_1_" .. v, { flag_data = f });
    end
    for k, v in pairs(flags_2) do
        local f = {};
        local addr = tonumber(v);
        local memdump = readByte(addr);
        f[v] = toBits(memdump, 8);
        sendPacket("flag_2_" .. v, { flag_data = f });
    end
    for k, v in pairs(flags_3) do
        local f = {};
        local addr = tonumber(v);
        local memdump = readByte(addr);
        f[v] = toBits(memdump, 8);
        sendPacket("flag_2_" .. v, { flag_data = f });
    end
end

function dumpSkulltulaStorage()
    for k, v in pairs(skulltulas) do
        local sdata = {};
        local addr = tonumber(v);
        local memdump = readByte(addr);
        sdata[v] = toBits(memdump, 8);
        sendPacket("skulltulas_" .. v, { skulltulas = sdata });
    end
end

function isSceneDungeon()
    for k, v in pairs(dungeon_scenes) do
        if (v == current_scene) then
            -- dungeon detected.
            return k;
        end
    end
    return nil;
end

local isKeysanity = false;

function dumpDungeonData()
    if (isKeysanity) then
        -- Assume nothing for Keysanity...
        if (isSceneDungeon() ~= nil) then
            for k, v in pairs(dungeon_stuff) do
                local memdump = readByte(v);
                local data = toBits(memdump, 8);
                local addr = DEC_HEX(v);
                sendPacket("dungeon_items", { addr = addr, dungeon_items = data });
            end
        end
    else
        local d = isSceneDungeon();
        if (d ~= nil) then
            local memdump = readByte(dungeon_stuff[d]);
            local data = toBits(memdump, 8);
            local addr = DEC_HEX(dungeon_stuff[d]);
            sendPacket("dungeon_items", { addr = addr, dungeon_items = data });
        end
    end
end

function writeDungeonData(packet)
    writeByte(tonumber(packet.addr), fromBits(packet.dungeon_items));
end

function dumpDungeonKeys(index)
    local addr = small_keys[index];
    local memdump = readByte(addr);
    sendPacket("small_keys", { dungeon_key = index, addr = DEC_HEX(addr), dungeon_key_payload = memdump });
end

function writeDungeonDelta(packet)
    local addr = tonumber(packet.addr);
    local current = readByte(addr);
    if (current == 255) then
        -- Initialize the storage in ram.
        current = 0;
        writeByte(addr, current);
        current = readByte(addr);
    end
    if (packet.override ~= nil) then
        current = packet.dungeon_key_delta;
    else
        current = current + packet.dungeon_key_delta;
    end
    writeByte(addr, current);
end

function writeSkulltulas(packet)
    writeByte(tonumber(packet.addr), fromBits(packet.skulltulas));
    writeByte(memory_lookup.skull_tokens_count, packet.skull_tokens_count);
end

function writeFlags(flags)
    writeByte(tonumber(flags.addr), fromBits(flags.flag_data));
end

function writeScene(data)
    for k, v in pairs(data.scene_data) do
        writeByte(tonumber(k), fromBits(v));
    end
end

display_messages = {};
display_message = "";
displayMessageTimer = 0;
displayMessageTimerMax = 300;

function sendMessage(msg)
    table.insert(display_messages, msg);
    console.writeline(msg);
end

function sendUpdate()
    readScene();
    updateDataFromRAM();
    for k, v in pairs(current_data) do
        local d = {};
        d[k] = v;
        sendPacket(k, d);
    end
    dumpDungeonData();
    local scene = isSceneDungeon();
    if (isKeysanity and scene ~= nil) then
        for k, v in pairs(dungeon_scenes) do
            dumpDungeonKeys(k);
        end
    else
        if (scene ~= nil) then
            dumpDungeonKeys(scene);
        end
    end
end

function updateScenes()
    --sendMessage("Updating scenes...");
    dumpScenes();
end

function updateFlags()
    --sendMessage("Updating flags...");
    dumpFlags();
    dumpSkulltulaStorage();
end

link_last_state = 0x0;

function checkForLinkState()
    local m = readByte(link_instance + link_flags_offset)
    if ((link_last_state == 0x20 or link_last_state == 0x30) and m == 0x0) then
        link_last_state = m;
        return true;
    end
    link_last_state = m;
    return false;
end

function checkLinkStateNoUpdate()
    return readByte(link_instance + link_flags_offset) == 0x0;
end

save_checksum = 0x11B922;

function checkForTitleScreen()
    local m = readTwoByteUnsigned(save_checksum)
    return m == 0x0000;
end

local last_scene = 0;
local isInDungeon = false;

function getCurrentScene()
    return readByte(memory_lookup.scene);
end

function checkForSceneChange()
    local m = getCurrentScene();
    if (last_scene ~= m) then
        last_scene = m;
        return true;
    end
    return false;
end

sendMessage("OoT Randomizer Co-op v" .. VERSION);
local connected = connectToNode();

-- The packet buffering is to ensure we don't write a payload during the title screen.
packet_buffer = {};

function buildPacketBuffer()
    local arriving = comm.httpGet("http://127.0.0.1:8082/oot/randomizer/awaiting");
    local unpack = json.decode(arriving);
    for k, v in pairs(unpack) do
        table.insert(packet_buffer, v);
    end
end

local ganonWarpEnabled = false;

function processPacketBuffer()
    if (next(packet_buffer) ~= nil) then
        local s = table.remove(packet_buffer, 1);
        if pcall(function()
            local packet = json.decode(from_base64(s));
            sendMessage(packet.message);
            if (packet.payload ~= nil) then
                for k, v in pairs(packet.payload) do
                    pcall(function()
                        write_handlers[k](k, v);
                    end);
                end
            end
            if (packet.scene_data ~= nil) then
                writeScene(packet);
            elseif (packet.flag_data ~= nil) then
                writeFlags(packet);
            elseif (packet.skulltulas ~= nil) then
                writeSkulltulas(packet);
            elseif (packet.scarecrow ~= nil) then
                dumpScarecrow();
            elseif (packet.pierre ~= nil) then
                writeScarecrow(packet);
            elseif (packet.ganon ~= nil) then
                ganonWarpEnabled = true;
            elseif (packet.dungeon_key_delta ~= nil) then
                writeDungeonDelta(packet);
            elseif (packet.dungeon_items ~= nil) then
                writeDungeonData(packet);
            end
        end) then
        else
            --console.log(s);
        end
    end
end

local already_synced = false;
local already_seen_menu = false;

local frame_count = 0;
local frame_count_max = 100;

function doPacketCheck()
    if (frame_count > frame_count_max) then
        already_synced = buildPacketBuffer();
        if (next(do_on_next_frame_check) ~= nil) then
            if (do_on_next_frame_check[1]()) then
                table.remove(do_on_next_frame_check, 1);
            end
        end
        frame_count = 0;
    else
        frame_count = frame_count + 1;
    end
end

function pause_check_packet_builder()
    if (checkForMenu() and already_synced == false and already_seen_menu == false) then
        already_seen_menu = true;
        already_synced = buildPacketBuffer();
    end
    if (checkForOverworld()) then
        already_seen_menu = false;
    end
end

function isPacketBufferEmpty()
    return next(packet_buffer) == nil;
end

local ganon_ent = {};
ganon_ent["0x11A5D0"] = 0;
ganon_ent["0x11A5D1"] = 0;
ganon_ent["0x11A5D2"] = 4;
ganon_ent["0x11A5D3"] = 31;
local ganon_scene = 25;

local do_on_each_frame = {};

function registerFrameHook(fn, maxframes)
    table.insert(do_on_each_frame, { fn = fn, maxframes = maxframes, framecount = 0 });
end

function runFrameHooks()
    if (next(do_on_each_frame) ~= nil) then
        local v = do_on_each_frame[1];
        v["fn"]();
        v["framecount"] = v["framecount"] + 1;
        if (v["framecount"] > v["maxframes"]) then
            table.remove(do_on_each_frame, 1);
        end
    end
end

function sendToGanon()
    -- sending to ganon.
    registerFrameHook(function()
        writeByte(link_instance + link_flags_offset, 0x80);
    end, 30);
    registerFrameHook(function()
        if (getCurrentScene() ~= 25) then
            for k, v in pairs(ganon_ent) do
                writeByte(tonumber(k), v);
            end
            writeByte(0x11A5D7, 0x0);
        end
    end, 1000);
end

local already_seen_menu = false;
local wasSentToGanon = false;

while true do
    already_synced = false;
    if (displayMessageTimer < displayMessageTimerMax) then
        gui.drawString(0, 0, display_message);
        displayMessageTimer = displayMessageTimer + 1;
    else
        if next(display_messages) ~= nil then
            display_message = table.remove(display_messages, 1);
            displayMessageTimer = 0;
        end
    end
    if (checkForTitleScreen() == false) then
        if (checkLinkStateNoUpdate()) then
            processPacketBuffer();
        end
        if (checkForLinkState()) then
            if (isPacketBufferEmpty()) then
                sendUpdate();
                updateScenes();
                updateFlags();
            end
        end
        if (checkForMenu()) then
            if (already_seen_menu ~= true) then
                if (joypad.get()["P1 DPad U"] == true) then
                    -- Need the random to sneak past the packet cache.
                    sendPacket("resync_me", { resync_me = true, random = math.random() });
                    already_seen_menu = true;
                end
            end
        else
            if (checkForOverworld()) then
                if (already_seen_menu) then
                    already_seen_menu = false;
                    wasSentToGanon = false;
                end
            end
        end
    end
    if (joypad.get()["P1 DPad L"] == true and wasSentToGanon == false) then
        if (ganonWarpEnabled) then
            wasSentToGanon = true;
            sendToGanon();
        end
    end
    doPacketCheck();
    runFrameHooks();
    emu.frameadvance();
end