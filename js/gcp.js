var SYSEX_NUM_BYTES = 16567;

var NUM_DEVICES = 8;
var NUM_PRESETS = 200;
var NUM_PEDALS = 2;
var NUM_GCX = 4;
var NUM_GCX_LOOPS = 8;
var NUM_GCX_SWITCHES = 8;
var NUM_SWITCH_FCN = 8;
var NUM_INSTANT_ACCESS = 8;

var NUM_BANKS = 20;
var NUM_PRESETS_PER_BANK = 10;

var PREAMBLE = [0xF0, 0x00, 0x00, 0x07, 0x10];
var TERMINATOR = [0xF7];

var CONFIG_NUM_BYTES = 161;
var PRESET_NUM_BYTES = 82;

var DEVICE_NAME_LENGTH = 8;
var PRESET_NAME_LENGTH = 10;

var CONFIG_OFFSET = PREAMBLE.length;
var PRESET_OFFSET = CONFIG_OFFSET + CONFIG_NUM_BYTES;
var TERMINATOR_OFFSET = PRESET_OFFSET + (PRESET_NUM_BYTES * NUM_PRESETS);

function pad(pad, str, padLeft) {
  if (str == undefined) return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}

var DeviceProgramChange = function(){
    this.onOff = 0;
    this.pc = 0;
};
DeviceProgramChange.prototype.init = function(arrayBuffer){
    var view = new Uint8Array(arrayBuffer);
    this.onOff = view.getUint8(0);
    this.pc = view.getUint8(1);
};
DeviceProgramChange.prototype.compile = function(){
    return [this.onOff, this.pc];
};

var Preset = function(){
    this.name = pad('          ', ' INIT');
    this.deviceProgramChanges = [];
    this.deviceProgramBanks = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // Unused
    this.pedalDefinitions = [];
    this.pedalDeviceAssignments = [];
    this.gcxLoopStates = [];
    this.gcxToggles = [];
    this.instantAccessState = [];

    this.LENGTHS = {};
    this.LENGTHS.name = PRESET_NAME_LENGTH;
    this.LENGTHS.deviceProgramChanges = NUM_DEVICES * 2;
    this.LENGTHS.deviceProgramBanks = 8;
    this.LENGTHS.pedalDefinitions = NUM_PEDALS;
    this.LENGTHS.pedalDeviceAssignments = NUM_PEDALS;
    this.LENGTHS.gcxLoopStates = NUM_GCX * NUM_GCX_LOOPS;
    this.LENGTHS.gcxToggles = NUM_GCX;
    this.LENGTHS.instantAccessState = NUM_INSTANT_ACCESS;

    this.OFFSETS = {};

    var i, begin, end;

    var keys = Object.keys(this.LENGTHS);

    for(i = 0; i < keys.length; i++){
        this.OFFSETS[keys[i]] = i == 0 ? 0 : this.OFFSETS[keys[i-1]] + this.LENGTHS[keys[i-1]];
    }

    for(i = 0; i < NUM_DEVICES; i++){
        this.deviceProgramChanges[i] = new DeviceProgramChange();
    }
    for(i = 0; i < NUM_PEDALS; i++){
        this.pedalDefinitions[i] = 0;
        this.pedalDeviceAssignments[i] = 1;
    }
    for(i = 0; i < NUM_GCX * NUM_GCX_LOOPS; i++ ){
        this.gcxLoopStates[i] = 0;
    }
    for(i = 0; i < NUM_GCX; i++){
        this.gcxToggles[i] = 0;
    }
    for(i = 0; i < NUM_INSTANT_ACCESS; i++){
        this.instantAccessState[i] = 0;
    }
};

Preset.prototype.setPresetName = function(name){
    // TODO character validation
    this.name = pad('          ', name.replace(/\s+$/g, "").toUpperCase());
    return this.getPresetName();
};
Preset.prototype.getPresetName = function(){
    return this.name.replace(/\s+$/g, "");
};

Preset.prototype.init = function(arrayBuffer){
    var view = new Uint8Array(arrayBuffer);
    var i, begin, end;

    this.name = Array.prototype.join.call(view.slice(0, PRESET_NAME_LENGTH));

    for(i = 0; i < NUM_DEVICES; i++){
        begin = this.OFFSETS.deviceProgramChanges + (i*2);
        end = begin + 2;
        this.deviceProgramChanges[i].init(view.slice(begin, end));
    }

    for(i = 0; i < NUM_PEDALS; i++){
        this.pedalDefinitions[i] = view.getUint8(this.OFFSETS.pedalDefinitions + i);
        this.pedalDeviceAssignments[i] = view.getUint8(this.OFFSETS.pedalDeviceAssignments + i);
    }

    for(i = 0; i < NUM_GCX * NUM_GCX_LOOPS; i++ ){
        this.gcxLoopStates[i] = view.getUint8(this.OFFSETS.gcxLoopStates + i);
    }

    for(i = 0; i < NUM_GCX; i++){
        this.gcxToggles[i] = view.getUint8(this.OFFSETS.gcxToggles + i);
    }
    for(i = 0; i < NUM_INSTANT_ACCESS; i++){
        this.instantAccessState[i] = view.getUint8(this.OFFSETS.instantAccessState + i);
    }
};
Preset.prototype.compile = function(){
    var self = this;
    var buffer = new Array(PRESET_NUM_BYTES);

    var i;

    for(i = 0; i < PRESET_NAME_LENGTH; i++){
        buffer[i] = this.name.charCodeAt(i);
    }

    for(i = 0; i < NUM_DEVICES; i++){
        var b = this.deviceProgramChanges[i].compile();
        b.forEach(function(e, j){
            buffer[self.OFFSETS.deviceProgramChanges + (i*2) + j] = e;
        });
    }
    for(i = 0; i < this.deviceProgramBanks.length; i++){
        buffer[this.OFFSETS.deviceProgramBanks + i] = this.deviceProgramBanks[i];
    }
    for(i = 0; i < NUM_PEDALS; i++){
        buffer[this.OFFSETS.pedalDefinitions + i] = this.pedalDefinitions[i];
        buffer[this.OFFSETS.pedalDeviceAssignments + i] = this.pedalDeviceAssignments[i];
    }
    for(i = 0; i < NUM_GCX * NUM_GCX_LOOPS; i++ ){
        buffer[this.OFFSETS.gcxLoopStates + i] = this.gcxLoopStates[i];
    }
    for(i = 0; i < NUM_GCX; i++){
        buffer[this.OFFSETS.gcxToggles + i] = this.gcxToggles[i];
    }
    for(i = 0; i < NUM_INSTANT_ACCESS; i++){
        buffer[this.OFFSETS.instantAccessState + i] = this.instantAccessState[i];
    }

    return buffer;
};

var SoftOptions = function(){
    this.val = 0;
};
SoftOptions.prototype.init = function(val){
    this.val = val;
};
SoftOptions.prototype.compile = function(){
    return [0];
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
    this.directorySpeed = 0x02;
    this.programChangeReceiveChannel = 0x01;
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
        this.switchFunctionDetails[i] = i;
        this.switchTransmitCC[i] = 0;
        this.switchType[i] = 0;
    }
};

Config.prototype.isDeviceEnabled = function(d){
    if(d < 0 || d > NUM_DEVICES){
        console.warn("Device number out of bounds");
        return false;
    } else {
        return this.deviceChannels[d] != 0;
    }
};

Config.prototype.setDeviceName = function(d, name){
    // TODO validate character set
    this.deviceNames[d] = pad('        ', name.replace(/\s+$/g, "").toUpperCase());
    return this.getDeviceName(d);
};
Config.prototype.getDeviceName = function(d){
    return this.deviceNames[d].replace(/\s+$/g, "");
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

Config.prototype.compile = function(){
    var buffer = new Array(CONFIG_NUM_BYTES);

    var i, j;

    for(i = 0; i < NUM_DEVICES; i++){
        for(j = 0; j < DEVICE_NAME_LENGTH; j++){
            buffer[(i*DEVICE_NAME_LENGTH)+j] = this.deviceNames[i].charCodeAt(j);
        }

        buffer[this.OFFSETS.deviceChannels+i] = this.deviceChannels[i];
        buffer[this.OFFSETS.deviceProgramOffsets+i] = this.deviceProgramOffsets[i];
        buffer[this.OFFSETS.deviceDefinitions+i] = this.deviceDefinitions[i];
    }

    for(i = 0; i < NUM_PEDALS; i++){
        buffer[this.OFFSETS.pedalsExist+i] = this.pedalsExist[i];
    }

    buffer[this.OFFSETS.extendedMem] = this.extendedMem;
    buffer[this.OFFSETS.vcaExists] = this.vcaExists;
    buffer[this.OFFSETS.numGCX] = this.numGCX;

    for(i = 0; i < this.LENGTHS.gcxSwitchTypes; i++){
        buffer[this.OFFSETS.gcxSwitchTypes+i] = this.gcxSwitchTypes[i];
    }

    buffer[this.OFFSETS.programAccessMode] = this.programAccessMode;
    buffer[this.OFFSETS.softOptions] = this.softOptions.compile()[0];
    buffer[this.OFFSETS.directorySpeed] = this.directorySpeed;
    buffer[this.OFFSETS.programChangeReceiveChannel] = this.programChangeReceiveChannel;

    for(i = 0; i < NUM_GCX_SWITCHES; i++){
        buffer[this.OFFSETS.switchFunctions+i] = this.switchFunctions[i];
        buffer[this.OFFSETS.switchFunctionDetails+i] = this.switchFunctionDetails[i];
        buffer[this.OFFSETS.switchTransmitCC+i] = this.switchTransmitCC[i];
        buffer[this.OFFSETS.switchType+i] = this.switchType[i];
    }

    return buffer;
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