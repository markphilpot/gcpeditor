
var SYSEX_NUM_BYTES = 16567;

var ALLOWED_NAME_CHARACTERS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // TODO find out special characters

var NUM_DEVICES = 8;
var NUM_PRESETS = 200;
var NUM_PEDALS = 2;
var NUM_GCX = 4;
var NUM_GCX_LOOPS = 8;
var NUM_GCX_SWITCHES = 8;
var NUM_SWITCH_FCN = 8;
var NUM_INSTANT_ACCESS = 8;

var PREAMBLE = [0xF0, 0x00, 0x00, 0x07, 0x10];
var TERMINATOR = [0xF7];

var CONFIG_NUM_BYTES = 161;
var PRESET_NUM_BYTES = 82;

var DEVICE_NAME_LENGTH = 8;
var PRESET_NAME_LENGTH = 10;

var CONFIG_OFFSET = PREAMBLE.length;
var PRESET_OFFSET = CONFIG_OFFSET + CONFIG_NUM_BYTES;
var TERMINATOR_OFFSET = PRESET_OFFSET + (PRESET_NUM_BYTES * NUM_PRESETS);

var Preset = function(){
    this.name = " INIT     ";
    this.deviceProgramChanges = [];
    this.deviceProgramBanks = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // Unused
    this.pedalDefinitions = [];
    this.pedalDeviceAssignments = [];
    this.gcxLoopStates = [];
    this.gcxToggles = [];
    this.instantAccessState = [];
};

var Config = function () {
    this.deviceNames = [];
    this.deviceChannels = [];
    this.deviceProgramOffsets = [];
    this.deviceDefinitions = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // Unused
    this.pedalsExist = [];
    this.extendedMem = 0x00;
    this.vcaExists = 0x00;
    this.numGCX = 0;
    this.gcxSwitchTypes = [];
    this.programAccessMode = 0x00;
    this.softOptions = new SoftOptions();
    this.directorySpeed = 0x01;
    this.programChangeReceiveChannel = 0x00;
    this.switchFunctions = [];
    this.switchFunctionDetails = [];
    this.switchTransmitCC = [];
    this.switchType = [];

    this.LENGTHS = {};
    this.LENGTHS.deviceNames = NUM_DEVICES * DEVICE_NAME_LENGTH;
    this.LENGTHS.deviceChannels = NUM_DEVICES;
    this.LENGTHS.deviceProgramOffsets = NUM_DEVICES;
    this.LENGTHS.deviceDefinitions = NUM_DEVICES;
    this.LENGTHS.pedalsExist = NUM_PEDALS;
    this.LENGTHS.extendedMem = 1;
    this.LENGTHS.vcaExists = 1;
    this.LENGTHS.numGCX = 1;
    this.LENGTHS.gcxSwitchTypes = NUM_GCX * NUM_GCX_SWITCHES;
    this.LENGTHS.programAccessMode = 1;
    this.LENGTHS.softOptions = 1;
    this.LENGTHS.directorySpeed = 1;
    this.LENGTHS.programChangeReceiveChannel = 1;
    this.LENGTHS.switchFunctions = NUM_GCX_SWITCHES;
    this.LENGTHS.switchFunctionDetails = NUM_GCX_SWITCHES;
    this.LENGTHS.switchTransmitCC = NUM_GCX_SWITCHES;
    this.LENGTHS.switchType = NUM_GCX_SWITCHES;

    this.OFFSETS = {};

    var i, begin, end;

    var keys = Object.keys(this.LENGTHS);

    for(i = 0; i < keys.length; i++){
        this.OFFSETS[keys[i]] = i == 0 ? 0 : this.OFFSETS[keys[i-1]] + this.LENGTHS[keys[i-1]];
    }

    for(i = 0; i < NUM_DEVICES; i++){
        this.deviceNames[i] = i == 0 ? "DEVICE  " : "        ";
        this.deviceChannels[i] = i == 0 ? 1 : 0;
        this.deviceProgramOffsets[i] = 0;
    }

    for(i = 0; i < NUM_PEDALS; i++){
        this.pedalsExist[i] = 0;
    }

    for(i = 0; i < (NUM_GCX*NUM_GCX_SWITCHES); i++){
        this.gcxSwitchTypes[i] = 0;
    }

    for(i = 0; i < NUM_GCX_SWITCHES; i++){
        this.switchFunctions[i] = 0;
        this.switchFunctionDetails[i] = 0;
        this.switchTransmitCC[i] = 0;
        this.switchType[i] = 0;
    }
};
Config.prototype.init = function(arrayBuffer){
    var view = new Uint8Array(arrayBuffer);
    var i, begin, end;

    for(i = 0; i < NUM_DEVICES; i++){
        begin = this.OFFSETS.deviceNames + (i * DEVICE_NAME_LENGTH);
        end = begin + DEVICE_NAME_LENGTH;
        this.deviceNames[i] = Array.prototype.join.call(view.slice(begin, end));

        this.deviceChannels[i] = view.getUint8(this.OFFSETS.deviceChannels + i);
        this.deviceProgramOffsets[i] = view.getUint8(this.OFFSETS.deviceProgramOffsets + i);
    }

    for(i = 0; i < NUM_PEDALS; i++){
        this.pedalsExist[i] = view.getUint8(this.OFFSETS.pedalsExist + i);
    }

    this.extendedMem = view.getUint8(this.OFFSETS.extendedMem);
    this.vcaExists = view.getUint8(this.OFFSETS.vcaExists);
    this.numGCX = view.getUint8(this.OFFSETS.numGCX);

    for(i = 0; i < this.LENGTHS.gcxSwitchTypes; i++){
        this.gcxSwitchTypes[i] = view.getUint8(this.OFFSETS.gcxSwitchTypes + i);
    }

    this.programAccessMode = view.getUint8(this.OFFSETS.programAccessMode);

    this.softOptions.init(view.getUint8(this.OFFSETS.softOptions));

    this.directorySpeed = view.getUint8(this.OFFSETS.directorySpeed);
    this.programChangeReceiveChannel = view.getUint8(this.OFFSETS.programChangeReceiveChannel);

    for(i = 0; i < NUM_GCX_SWITCHES; i++){
        this.switchFunctions[i] = view.getUint8(this.OFFSETS.switchFunctions + i);
        this.switchFunctionDetails[i] = view.getUint8(this.OFFSETS.switchFunctionDetails + i);
        this.switchTransmitCC[i] = view.getUint8(this.OFFSETS.switchTransmitCC + i);
        this.switchType[i] = view.getUint8(this.OFFSETS.switchType + i);
    }
};

var GcpSyxEx = function(){
    this.sysEx = new DataView(new ArrayBuffer(SYSEX_NUM_BYTES));
    this.config = new Config();
    this.presets = [];

    for(var i = 0; i < NUM_PRESETS; i++){
        this.presets[i] = new Preset();
    }
};

GcpSyxEx.prototype.init = function(arrayBuffer){
    var i, begin, end;

    begin = CONFIG_OFFSET;
    end = begin + CONFIG_NUM_BYTES;

    this.config.init(arrayBuffer.slice(begin, end));

    for(i = 0; i < NUM_PRESETS; i++){
        begin = PRESET_OFFSET + (i*PRESET_NUM_BYTES);
        end = begin + PRESET_NUM_BYTES;
        this.presets[i].init(arrayBuffer.slice(begin, end));
    }
};

GcpSyxEx.prototype.compile = function(){
    var self = this;

    PREAMBLE.forEach(function(e, i){
        self.sysEx.setUint8(i, e);
    });

    var b = this.config.compile();
    b.forEach(function(e, i){
        self.sysEx.setUint8(CONFIG_OFFSET + i, e);
    });

    self.presets.forEach(function(p, index){
        b = p.compile();
        b.forEach(function(e, i){
            self.sysEx.setUint8(PRESET_OFFSET + (index*PRESET_NUM_BYTES) + i, e);
        });
    });

    TERMINATOR.forEach(function(e, i){
        self.sysEx.setUint8(TERMINATOR_OFFSET+i, e);
    });

    return self.sysEx.buffer;
};

GcpSyxEx.prototype.download = function(){
    var blob = new Blob([this.compile()], {type: "application/octet-stream"});
    saveAs(blob, "gcp.syx");
};