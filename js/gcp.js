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
    var view = new DataView(arrayBuffer);
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
    var pedalInit = [0x0A, 0x13]; // initial values from GCP init
    for(i = 0; i < NUM_PEDALS; i++){
        this.pedalDefinitions[i] = pedalInit[i];
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
    var view = new DataView(arrayBuffer);
    var i, begin, end;

    var decoder = new TextDecoder();

    this.name = decoder.decode(new DataView(arrayBuffer.slice(0, PRESET_NAME_LENGTH)));

    for(i = 0; i < NUM_DEVICES; i++){
        begin = this.OFFSETS.deviceProgramChanges + (i*2);
        end = begin + 2;
        this.deviceProgramChanges[i].init(arrayBuffer.slice(begin, end));
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
Preset.prototype.toCSV = function(){
    var self = this;

    // Columns
    // 0 - Preset Name
    // 1 - Device #1 On/Off
    // 2 - Device #1 Preset
    // 3-16 - Device #X On/Off, Device #X Preset
    // 17 - Pedal #1 Device
    // 18 - Pedal #1 Assignment
    // 19 - Pedal #2 Device
    // 20 - Pedal #2 Assignment
    // 21 - GCX Loop State (4*8)
    //    - GCX Toggles (4)
    //    - Instant Access (8)

    var row = [];

    row.push(self.name);

    for(var i = 0; i < NUM_DEVICES; i++){
        row.push(self.deviceProgramChanges[i].onOff);
        row.push(self.deviceProgramChanges[i].pc);
    }

    for(var i = 0; i < NUM_PEDALS; i++){
        row.push(self.pedalDefinitions[i]);
        row.push(self.pedalDeviceAssignments[i]);
    }

    for(var i = 0; i < NUM_GCX * NUM_GCX_LOOPS; i++ ){
        row.push(self.gcxLoopStates[i]);
    }
    for(var i = 0; i < NUM_GCX; i++){
        row.push(self.gcxToggles[i]);
    }
    for(var i = 0; i < NUM_INSTANT_ACCESS; i++){
        row.push(self.instantAccessState[i]);
    }

    return row;
}
Preset.prototype.fromCSV = function(row){
    var self = this;

    var NAME_OFFSET = 0;
    var DEV_PC_OFFSET = 1;
    var PEDAL_OFFSET = DEV_PC_OFFSET + (2*NUM_DEVICES);
    var GCX_STATE_OFFSET = PEDAL_OFFSET + (2*NUM_PEDALS);
    var GCX_TOGGLE_OFFSET = GCX_STATE_OFFSET + (NUM_GCX * NUM_GCX_LOOPS);
    var IA_OFFSET = GCX_TOGGLE_OFFSET + NUM_GCX;

    self.name = row[NAME_OFFSET];
    for(var i = 0; i < NUM_DEVICES; i++){
        var onOff = row[DEV_PC_OFFSET+(2*i)];
        var pc = row[DEV_PC_OFFSET+(2*i)+1];
        self.deviceProgramChanges[i].onOff = onOff;
        self.deviceProgramChanges[i].pc = pc;
    }
    for(var i = 0; i < NUM_PEDALS; i++){
        var pedalDef = row[PEDAL_OFFSET+(2*i)];
        var pedalDevAssignment = row[PEDAL_OFFSET+(2*i)+1];
        self.pedalDefinitions[i] = pedalDef;
        self.pedalDeviceAssignments[i] = pedalDevAssignment;
    }
    for(var i = 0; i <  NUM_GCX * NUM_GCX_LOOPS; i++){
        self.gcxLoopStates[i] = row[GCX_STATE_OFFSET+i];
    }
    for(var i = 0; i < NUM_GCX; i++){
        self.gcxToggles[i] = row[GCX_TOGGLE_OFFSET+i];
    }
    for(var i = 0; i < NUM_INSTANT_ACCESS; i++){
        self.instantAccessState[i] = row[IA_OFFSET+i];
    }
}

// From Spec:
// 76543210 # Bit numbers for \/\/
// X0XX000X where X=don’t care and 0 is used as follows: 
//      D1=Global Program ON(1)/OFF(0) 
//      D3,D2=Link Mode:NONE(00), MASTER(01), or SLAVE(10) 
//      D6=Respond to MIDI Program Change, ON(1)/OFF(0)
//
// Note: It seems the GCP device (v1.13 firmware at least) doesn't obey the spec.
//       The Global Program bit is bit 0, rather than bit 1, so the pattern is
//       X0XX00X0 instead.  The code below reflects that.
//
// Some Examples:
// 01 == Global Program: ON, Link Mode: NONE, Respond to MIDI PC: OFF
// 41 == Global Program: ON, Link Mode: NONE, Respond to MIDI PC: ON
var SoftOptions = function(){
    this.val = 0;

    this.PROG_MASK = 0x01; // 0000 0001
    this.PROG_UMASK = 0xFE; // 1111 1110
    this.PROG_SHIFT = 0;
    this.LINK_MASK = 0x06; // 0000 1100
    this.LINK_UMASK = 0xF3; // 1111 0011
    this.LINK_SHIFT = 2;
    this.RESPOND_MASK = 0x40; // 0100 0000
    this.RESPOND_UMASK = 0xBF; // 1011 1111
    this.RESPOND_SHIFT = 6;
};
SoftOptions.prototype.init = function(val){
    this.val = val;
};
SoftOptions.prototype.compile = function(){
    return [this.val];
};

SoftOptions.prototype.setRespond = function(v){
    this.val &= this.RESPOND_UMASK;
    this.val |= (v << this.RESPOND_SHIFT);
};
SoftOptions.prototype.getRespond = function(){
    return (this.val & this.RESPOND_MASK) >> this.RESPOND_SHIFT;
};

SoftOptions.prototype.setGlobalProgram = function(v){
    this.val &= this.PROG_UMASK;
    this.val |= (v << this.PROG_SHIFT);
};
SoftOptions.prototype.getGlobalProgram = function(){
    return (this.val & this.PROG_MASK) >> this.PROG_SHIFT;
};

SoftOptions.prototype.setLinkMode = function(v){
    this.val &= this.LINK_UMASK;
    this.val |= (v << this.LINK_SHIFT);
};
SoftOptions.prototype.getLinkMode = function(){
    return (this.val & this.LINK_MASK) >> this.LINK_SHIFT;
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
    this.programChangeReceiveChannel = 0x00;

    // Instant Access Buttons
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
    this.LENGTHS.switchFunctions = NUM_INSTANT_ACCESS;
    this.LENGTHS.switchFunctionDetails = NUM_INSTANT_ACCESS;
    this.LENGTHS.switchTransmitCC = NUM_INSTANT_ACCESS;
    this.LENGTHS.switchType = NUM_INSTANT_ACCESS;

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

    for(i = 0; i < NUM_INSTANT_ACCESS; i++){
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
    var view = new DataView(arrayBuffer);
    var i, begin, end;

    var decoder = new TextDecoder();

    for(i = 0; i < NUM_DEVICES; i++){
        begin = this.OFFSETS.deviceNames + (i * DEVICE_NAME_LENGTH);
        end = begin + DEVICE_NAME_LENGTH;
        this.deviceNames[i] = decoder.decode(new DataView(arrayBuffer.slice(begin, end)));

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

        // init so it matches the GCP init state
        if(i != 0 && i != 128){
            for(var j = 0; j < NUM_DEVICES-1; j++) {
                this.presets[i].deviceProgramChanges[j].onOff = 1;
                this.presets[i].deviceProgramChanges[j].pc = (i%128) - 1;
            }
        }
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

GcpSyxEx.prototype.presetsToCSV = function(){
    var self = this;

    // Columns
    // 0 - Preset Name
    // 1 - Device #1 On/Off
    // 2 - Device #1 Preset
    // 3-16 - Device #X On/Off, Device #X Preset
    // 17 - Pedal #1 Device
    // 18 - Pedal #1 Assignment
    // 19 - Pedal #2 Device
    // 20 - Pedal #2 Assignment
    // 21 - GCX Loop State (4*8)
    //    - GCX Toggles (4)
    //    - Instant Access (8)

    var csv = [];

    var headers = [
        'Preset Name',
    ]

    for(var i = 0; i < NUM_DEVICES; i++){
        headers.push(sprintf("Device #%d On/Off", i+1));
        headers.push(sprintf("Device #%d Preset", i+1));
    }
    for(var i = 0; i < NUM_PEDALS; i++){
        headers.push(sprintf('Pedal #%d Device', i+1));
        headers.push(sprintf('Pedal #%d Assignment', i+1));
    }
    for(var i = 0; i < (NUM_GCX * NUM_GCX_LOOPS); i++){
        headers.push(sprintf('GCX #%d Loop #%d', (i/NUM_GCX)+1, (i%NUM_GCX_LOOPS)+1));
    }
    for(var i = 0; i < NUM_GCX; i++){
        headers.push(sprintf('GCX #%d Toggle', i+1));
    }
    for(var i = 0; i < NUM_INSTANT_ACCESS; i++){
        headers.push(sprintf('IA #%d', i+1))
    }

    csv.push(headers);

    self.presets.forEach(function(p, index){
        csv.push(p.toCSV())
    });

    return Papa.unparse(csv);
}
GcpSyxEx.prototype.presetsFromCSV = function(csv){
    var self = this;

    if(csv.length != NUM_PRESETS){
        console.error('Invalid CSV File')
        return false;
    }

    for(var i = 0; i < NUM_PRESETS; i++){
        self.presets[i].fromCSV(csv[i]);
    }

    return true;
}

GcpSyxEx.prototype.downloadCSV = function(){
    var blob = new Blob([this.presetsToCSV()], {type: "text/csv;charset=utf-8"});
    saveAs(blob, "presets.csv");
}

GcpSyxEx.prototype.download = function(){
    var blob = new Blob([this.compile()], {type: "application/octet-stream"});
    saveAs(blob, "gcp.syx");
};
