var gcp = new GcpSyxEx();

$(function(){
    $.event.props.push('dataTransfer');

    init();

    render();

    var $drop = $("#drop_zone");

    $drop.bind('dragover', function(e){
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    $drop.bind('drop', function(e){
        e.stopPropagation();
        e.preventDefault();

        var f = e.dataTransfer.files[0];

        var reader = new FileReader();

        reader.onloadend = function(){

            if(reader.result.byteLength != SYSEX_NUM_BYTES){
                $.jGrowl("Invalid syx file");
                return;
            }

            gcp.init(reader.result);

            render();

            $('#presetPanel').collapse('toggle');
        };
        reader.readAsArrayBuffer(f);
    });

    $('#download').click(function(){
        gcp.download();
    });

    $('#copy-presets').click(function(){

        var dt = $("#preset_table").DataTable();

        if($(this).attr('data-next') == 'done') {
            $(this).attr('data-next', 'copy');
            $(this).html("Done");

            dt.column(5).visible(true);

        } else {
            $(this).attr('data-next', 'done');
            $(this).html("Copy Presets");

            dt.column(5).visible(false);
        }

    });

    $('#import-presets').click(function(){

        var altGcp = new GcpSyxEx();

        var $dialog = $('<div/>').appendTo($('body'));

        $("<p>Import presets from an alternate syx file</p>").appendTo($dialog);

        var $drop = $('<div class="import_drop">Drop .syx file here</div>').appendTo($dialog);

        $drop.bind('dragover', function(e){
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        $drop.bind('drop', function(e){
            e.stopPropagation();
            e.preventDefault();

            var f = e.dataTransfer.files[0];

            var reader = new FileReader();

            reader.onloadend = function(){

                if(reader.result.byteLength != SYSEX_NUM_BYTES){
                    $.jGrowl("Invalid syx file");
                    return;
                }

                altGcp.init(reader.result);

                // Show import table
                $drop.remove();

                var $table = $('<table/>').appendTo($dialog);

                var $theader = $('<thead/>').appendTo($table);
                $('<tr></tr><th>&nbsp</th><th>Preset</th><th>Name</th><th>Target</th></tr>').appendTo($theader);

                var $tbody = $('<tbody/>').appendTo($table);

                for(var i = 0; i < NUM_PRESETS; i++){
                    var $tr = $(sprintf('<tr data-preset="%d"/>', i)).appendTo($tbody);
                    $('<td><input type="checkbox"></td>').appendTo($tr);
                    $(sprintf('<td>Preset %d</td>', i)).appendTo($tr);
                    $(sprintf('<td>%s</td>', altGcp.presets[i].getPresetName())).appendTo($tr);
                    $('<td><input class="target-preset" type="text" size="4" maxlength="3"></td>').appendTo($tr);
                }

                $table.dataTable({
                    paging: false,
                    info: false,
                    scrollY: "100%"
                });
            };
            reader.readAsArrayBuffer(f);
        });

        $dialog.dialog({
            title: 'Import Presets',
            autoOpen: true,
            closeOnEscape: true,
            width: 500,
            height: 400,
            buttons: [
                {
                    text: "Import",
                    click: function(){

                        $dialog.find('input:checked').each(function(){
                            var srcNum = $(this).closest('tr').attr('data-preset');
                            var targetNum = $(this).closest('tr').find('.target-preset').val();

                            //TODO validate target
                            srcNum = parseInt(srcNum, 10);
                            targetNum = parseInt(targetNum, 10);

                            // Perform copy
                            var src = altGcp.presets[srcNum];

                            var target = gcp.presets[targetNum];

                            var b = src.compile();
                            var ab = new DataView(new ArrayBuffer(PRESET_NUM_BYTES));

                            for(var i = 0; i < b.length; i++){
                                ab.setUint8(i, b[i]);
                            }

                            target.init(ab.buffer);

                        });

                        $(document).trigger('presets:import', [{}]);

                        $dialog.dialog('close');

                        $.jGrowl("Import complete");

                    }
                }, {
                    text: "Cancel",
                    click: function(){
                        $dialog.dialog('close');
                    }
                }
            ]
        });

        $dialog.on('dialogclose', function(e){
            $dialog.remove();
        });

    });
});

function init(){
    var $base = $('#gcp');

    var $deviceConfig = $base.find('#configPanel .device');

    for(var i = 1; i < NUM_DEVICES; i++){
        var $clone = $deviceConfig.clone().appendTo($('#devices'));

        $clone.attr('data-device', i);
        $clone.find('span.device_enabled_title').html(sprintf("Device #%d", i+1));
    }

    var $iaButton = $base.find('#configPanel .instantAccessBtn');

    for(var i = 1; i < NUM_INSTANT_ACCESS; i++){
        var $clone = $iaButton.clone().appendTo($('#instant'));

        $clone.attr('data-btn', i);
        $clone.find('label span').html(i+1);
    }

    //jQuery.fn.dataTableExt.oPagination.iFullNumbersShowPages = 20;

    var dt = $('#preset_table').DataTable({
        //paging: false,
        lengthMenu: [4, 8, 10, 12, 25, 50, 100],
        pageLength: 10,
        info: false,
        //pagingType: 'full_numbers',
        //searching: false,
        //ordering: false,
        scrollY: "100%",
        columns: [
            {title: 'pNum', visible: false},
            {title: 'Preset', width: '20px'},
            {title: 'Name', width: '100px'},
            {title: 'Devices'},
            {title: 'Settings'},
            {title: 'Copy'}
        ]
    });

    var bank10Labels = "0123456789ABCDEFGHIJ";

    for(var i = 0; i < NUM_PRESETS; i++){
        dt.row.add([
            i,
            sprintf("%s%d", bank10Labels[Math.floor(i/10)], i%10),
            '<input type="text" class="form-control presetName" size="11" maxlength="10">',
            '<div class="deviceProgramChanges form-group"/>',
            '<button type="button" class="btn btn-default btn-xs presetPedals">Pedals</button> <button type="button" class="btn btn-default btn-xs loopStates">Loop States</button> <button type="button" class="btn btn-default btn-xs iaStates">Instant Access</button>',
            '<button class="copy-p btn btn-default btn-xs" type="button">Copy..</button>'
        ]);
    }

    dt.draw();

    $('#presetPanel').on('shown.bs.collapse', function(){
        dt.columns.adjust().draw();
    });

    dt.rows().every(function(){

        var $p = $(this.node());
        var pNum = +this.data()[0];

        $p.find('.copy-p').click(function(){
            bootbox.prompt({
                title: sprintf("Copy preset %d to target (overwrite)", pNum),
                callback: function(result){


                    if(result === null){
                        // Dismiss
                    } else {
                        var t = parseInt(result, 10);

                        if(t < 0 || t > 199){
                            $.jGrowl(sprintf("Invalid target preset (%d)", t));
                            return;
                        }

                        // Perform copy
                        var src = gcp.presets[pNum];

                        var target = gcp.presets[t];

                        var b = src.compile();
                        var ab = new DataView(new ArrayBuffer(PRESET_NUM_BYTES));

                        for(var i = 0; i < b.length; i++){
                            ab.setUint8(i, b[i]);
                        }

                        target.init(ab.buffer);

                        $(document).trigger('presets:copy', [{src: pNum, target: t}]);
                    }
                }
            })
        });
    });

    dt.column(5).visible(false);
}

function render(){
    renderConfig();
    renderPreset();
}

function renderPreset(){

    var $base = $('#gcp');

    var dt = $('#preset_table').DataTable();

    var syncNumDisplay = function(){

        dt.rows().every(function(){
            var pNum = +this.data()[0];

            if(gcp.config.programAccessMode == 0){
                // Bank 10
                var bank10Labels = "0123456789ABCDEFGHIJ";
                dt.cell(pNum, 1).data(sprintf("%s%d", bank10Labels[Math.floor(pNum/10)], pNum%10));
            } else {
                // Bank 4
                var bank4Labels = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                dt.cell(pNum, 1).data(sprintf("%s%d", bank4Labels[Math.floor(pNum/4)], pNum%4 + 1));
            }
        });

    };

    syncNumDisplay();

    $(document).on('config:programAccessMode:change', function(event, data){
        syncNumDisplay();
        dt.draw();
    });

    dt.rows().every(function(){
        var $p = $(this.node());
        var pNum = +this.data()[0];

        var syncDev = function(d, $changes){
            var $d = $(sprintf('<div class="checkbox"><label><input type="checkbox" class="preset_device_enabled" data-device="%d"> <span class="preset_device_enabled_title">%s</span></label></div>', d, gcp.config.deviceNames[d])).appendTo($changes);

            $d.find('input').prop('checked', gcp.presets[pNum].deviceProgramChanges[d].onOff != 0);

            var $input = $(sprintf('<input type="text" class="preset_device_change form-control" data-device="%d" size="3"/>', d)).appendTo($changes);

            $input.val(gcp.config.deviceProgramOffsets[d] == 0 ? gcp.presets[pNum].deviceProgramChanges[d].pc + 1 : gcp.presets[pNum].deviceProgramChanges[d].pc);

            $d.find('.preset_device_enabled').click(function(){
                var dNum = $(this).attr('data-device');
                if($(this).prop('checked')){
                    gcp.presets[pNum].deviceProgramChanges[dNum].onOff = 1;
                } else {
                    gcp.presets[pNum].deviceProgramChanges[dNum].onOff = 0;
                }
            });

            $input.blur(function(){
                var newVal = gcp.config.deviceProgramOffsets[d] == 0 ? +$(this).val()-1 : +$(this).val();

                if(gcp.config.deviceProgramOffsets[d] == 0 && newVal < 0){
                    $.jGrowl("Device Program Change out of range");
                    $(this).val(gcp.presets[pNum].deviceProgramChanges[d].pc + 1);
                }

                // TODO add more range checking

                gcp.presets[pNum].deviceProgramChanges[d].pc = newVal;
            });
        };

        var sync = function(){
            $p.find('.presetName').val(gcp.presets[pNum].name);

            var $changes = $p.find('.deviceProgramChanges');

            $changes.html("");

            for(var i = 0; i < NUM_DEVICES; i++){
                if(gcp.config.isDeviceEnabled(i)){
                    syncDev(i, $changes);
                }
            }
        };

        $(document).on('config:deviceName:change config:deviceEnabled:change presets:copy presets:import', function(event, data){
            sync();
        });

        sync();

        $p.find('.presetName').blur(function(){
            $(this).val(gcp.presets[pNum].setPresetName($(this).val()));
        }).keyup(function(){
            $(this).val(
                $(this).val().replace(/[^a-zA-Z0-9 \-><]/g, function(str){
                    return '';
                })
            );
        }).focusin(function(){
            $(this).val($(this).val().replace(/\s+$/g, ""));
        });

        if(gcp.config.pedalsExist[0] == 1 || gcp.config.pedalsExist[1] == 1){
            $p.find('.presetPedals').show();
        } else {
            $p.find('.presetPedals').hide();
        }
        if(gcp.config.numGCX > 0){
            $p.find('.loopStates').show();
        } else {
            $p.find('.loopStates').hide();
        }

        $(document).on('config:pedalExists:change', function(event, data){
            if(gcp.config.pedalsExist[0] == 1 || gcp.config.pedalsExist[1] == 1) {
                $p.find('.presetPedals').show();
            } else {
                $p.find('.presetPedals').hide();
            }
        });

        $(document).on('config:numGCX:change', function(event, data){
            if(gcp.config.numGCX > 0){
                $p.find('.loopStates').show();
            } else {
                $p.find('.loopStates').hide();
            }
        });

        $p.find('.presetPedals').unbind('click').click(function(){
            var $dialog = $('<div/>').appendTo($('body'));

            var buildPC = function(p){
                var $wrapper = $('<div class="form-group"></div>').appendTo($dialog);
                var $label = $(sprintf('<label>Pedal %d Device </label>', p+1)).appendTo($wrapper);
                var $sel = $(sprintf('<select class="form-control" data-p="%d"></select>', p)).appendTo($label);

                for(var i = 0; i < NUM_DEVICES; i++){
                    $(sprintf('<option value="%d">%d</option>', i+1, i+1)).appendTo($sel);
                }

                $sel.change(function(){
                    gcp.presets[pNum].pedalDeviceAssignments[p] = +$(this).val();
                }).val(gcp.presets[pNum].pedalDeviceAssignments[p]);

                $wrapper = $('<div class="form-group"></div>').appendTo($dialog);
                $label = $(sprintf('<label>Pedal %d MIDI Definition </label>', p+1)).appendTo($wrapper);
                $sel = $(sprintf('<select class="form-control" data-p="%d"></select>', p)).appendTo($label);

                if(gcp.presets[pNum].pedalDeviceAssignments[p] == 8 && gcp.config.vcaExists == 1){
                    $('<option value="0">Off</option>').appendTo($sel);
                    $('<option value="1">VCA Stereo</option>').appendTo($sel);
                    $('<option value="2">VCA Pan</option>').appendTo($sel);
                    $('<option value="3">VCA Left</option>').appendTo($sel);
                    $('<option value="4">VCA Right</option>').appendTo($sel);
                } else {
                    $('<option value="0">Off</option>').appendTo($sel);
                    $('<option value="1">Pitchbend</option>').appendTo($sel);
                    $('<option value="2">Aftertouch</option>').appendTo($sel);
                    for(var i = 3; i < 124; i++){
                        $(sprintf('<option value="%d">MIDI Controller #%d</option>', i, i-2)).appendTo($sel);
                    }
                }

                $sel.change(function(){
                    gcp.presets[pNum].pedalDefinitions[p] = +$(this).val();
                }).val(gcp.presets[pNum].pedalDefinitions[p]);
            };

            for(var i = 0; i < NUM_PEDALS; i++){
                if(gcp.config.pedalsExist[i] == 1){
                    buildPC(i);
                }
            }

            $dialog.dialog({
                title: sprintf('Preset %d Pedal Configuration', pNum),
                autoOpen: true,
                closeOnEscape: true,
                width: 500,
                height: 400,
                buttons: [
                    {
                        text: "Close",
                        click: function(){

                            $dialog.dialog('close');

                        }
                    }
                ]
            });

            $dialog.on('dialogclose', function(e){
                $dialog.remove();
            });
        });

        $p.find('.loopStates').unbind('click').click(function(){
            var $dialog = $('<div/>').appendTo($('body'));

            var $table = $('<table/>').appendTo($dialog);

            var columns = [{title: '&nbsp;'}];
            for(var i = 0; i < gcp.config.numGCX; i++){
                columns.push({title: sprintf('GCX %d', i+1)});
            }

            var dt = $table.DataTable({
                paging: false,
                info: false,
                searching: false,
                ordering: false,
                scrollY: "100%",
                columns: columns
            });

            var row = [];

            // Send Data
            row.push("Send GCX Data");
            for(var i = 0; i < gcp.config.numGCX; i++){
                row.push(sprintf('<input type="checkbox" class="sendGCX" data-gcx="%d" data-size="mini">', i));
            }

            dt.row.add(row);

            for(var i = 0; i < NUM_GCX_LOOPS; i++){
                row = [sprintf('Loop %d State', i+1)];
                for(var j = 0; j < gcp.config.numGCX; j++){
                    row.push(sprintf('<input type="checkbox" class="loopState" data-loop="%d" data-gcx="%d" data-size="mini">', i, j));
                }
                dt.row.add(row);
            }

            dt.draw();

            $dialog.on('dialogopen dialogresize', function(e){
                dt.columns.adjust().draw();
            });

            $table.find('.sendGCX').bootstrapSwitch({
                onText: "Yes",
                offText: "No"
            }).each(function(){
                var gcx = +$(this).attr('data-gcx');
                $(this).bootstrapSwitch('state', gcp.presets[pNum].gcxToggles[gcx] == 0);
            }).on('switchChange.bootstrapSwitch', function(event, state){
                var gcx = +$(this).attr('data-gcx');
                gcp.presets[pNum].gcxToggles[gcx] = state ? 0 : 1;
            });

            $table.find('.loopState').bootstrapSwitch({
                onText: "On",
                offText: "Off"
            }).each(function(){
                var gcx = +$(this).attr('data-gcx');
                var ls = +$(this).attr('data-loop');
                $(this).bootstrapSwitch('state', gcp.presets[pNum].gcxLoopStates[gcx*NUM_GCX_LOOPS+ls] == 1);
            }).on('switchChange.bootstrapSwitch', function(event, state){
                var gcx = +$(this).attr('data-gcx');
                var ls = +$(this).attr('data-loop');
                gcp.presets[pNum].gcxLoopStates[gcx*NUM_GCX_LOOPS+ls] = state ? 1 : 0;
            });

            $dialog.dialog({
                title: sprintf('Preset %d GCX Loop States', pNum),
                autoOpen: true,
                closeOnEscape: true,
                width: 500,
                height: 550,
                buttons: [
                    {
                        text: "Close",
                        click: function(){

                            $dialog.dialog('close');

                        }
                    }
                ]
            });

            $dialog.on('dialogclose', function(e){
                $dialog.remove();
            });
        });

        $p.find('.iaStates').unbind('click').click(function(){
            var $dialog = $('<div/>').appendTo($('body'));

            var buildIa = function(ia){
                var $wrapper = $('<div class="form-group"></div>').appendTo($dialog);
                var $label = $(sprintf('<label>Instant Access %d State </label>', ia+1)).appendTo($wrapper);
                var $toggle = $(sprintf('<input type="checkbox" data-ia="%d" data-size="mini">', ia)).appendTo($label);

                $toggle.bootstrapSwitch({
                    onText: "On",
                    offText: "Off"
                }).on('switchChange.bootstrapSwitch', function(event, state){
                    gcp.presets[pNum].instantAccessState[ia] = state ? 1 : 0;
                }).bootstrapSwitch('state', gcp.presets[pNum].instantAccessState[ia] == 1);
            };

            for(var i = 0; i < NUM_INSTANT_ACCESS; i++){
                buildIa(i);
            }

            $dialog.dialog({
                title: sprintf('Preset %d Instant Access', pNum),
                autoOpen: true,
                closeOnEscape: true,
                width: 350,
                height: 460,
                buttons: [
                    {
                        text: "Close",
                        click: function(){

                            $dialog.dialog('close');

                        }
                    }
                ]
            });

            $dialog.on('dialogclose', function(e){
                $dialog.remove();
            });

        });

    });

    dt.draw();
}

function renderConfig(){

    var $base = $('#gcp');

    $base.find('#configPanel .device').each(function(){
        var $d = $(this);
        var dNum = $d.attr('data-device');

        var sync = function(){
            $d.find('.deviceName').val(gcp.config.deviceNames[dNum]);
            $d.find('.deviceChannel').val(gcp.config.deviceChannels[dNum]);
            $d.find('.deviceProgramOffset').val(gcp.config.deviceProgramOffsets[dNum]);
        };

        if(gcp.config.deviceChannels[dNum] == 0){
            //Disabled
            $d.find('fieldset').attr('disabled', 'disabled');
        } else {
            $d.find('.device_enabled').prop('checked', true);
            $d.find('fieldset').removeAttr('disabled');
        }

        sync();

        $d.find('.device_enabled').click(function(){
            if($(this).prop('checked')){
                $d.find('fieldset').removeAttr('disabled');
                gcp.config.deviceChannels[dNum] = 1;
            } else {
                $d.find('fieldset').attr('disabled', 'disabled');
                gcp.config.deviceChannels[dNum] = 0;
                gcp.config.setDeviceName(dNum, "        ");
            }
            sync();
            $(document).trigger('config:deviceEnabled:change', [{device: dNum}]);
        });

        $d.find('.deviceName').blur(function(){
            $(this).val(gcp.config.setDeviceName(dNum, $(this).val()));
            $(document).trigger('config:deviceName:change', [{device: dNum}]);
        }).keyup(function(){
            $(this).val(
                $(this).val().replace(/[^a-zA-Z0-9 \-><]/g, function(str){
                    return '';
                })
            );
        }).focusin(function(){
            $(this).val($(this).val().replace(/\s+$/g, ""));
        });
    });

    $base.find('.pedal').bootstrapSwitch({
        onText: "Yes",
        offText: "No"
    }).on('switchChange.bootstrapSwitch', function(event, state){
        var p = +$(this).attr('data-pedal');
        gcp.config.pedalsExist[p] = state ? 1 : 0;
        $(document).trigger("config:pedalExists:change", [{pedal: p, exists: state ? 1 : 0}]);
    }).each(function(){
        var p = +$(this).attr('data-pedal');
        $(this).bootstrapSwitch('state', gcp.config.pedalsExist[p] == 1);
    });

    $base.find('.vca').bootstrapSwitch({
        onText: "Yes",
        offText: "No"
    }).on('switchChange.bootstrapSwitch', function(event, state){
        gcp.config.vcaExists = state ? 1 : 0;
    }).bootstrapSwitch('state', gcp.config.vcaExists == 1);

    $base.find('.numGCX').change(function(){
        gcp.config.numGCX = +$(this).val();

        var $wrapper = $('.gcxSwitchTypes');
        $wrapper.html("");

        var buildSwitch = function(i, j){
            var $label = $(sprintf('<label>Switch %d</label>', j+1)).appendTo($sw);
            var $toggle = $('<input type="checkbox" data-size="mini">').appendTo($label);
            $toggle.bootstrapSwitch({
                onText: "Latching",
                offText: "Momentary"
            }).on('switchChange.bootstrapSwitch', function(event, state){
                gcp.config.gcxSwitchTypes[i*NUM_GCX_SWITCHES+j] = state ? 0 : 1;
            }).bootstrapSwitch('state', gcp.config.gcxSwitchTypes[i*NUM_GCX_SWITCHES+j] == 0);
        };

        for(var i = 0; i < gcp.config.numGCX; i++){
            var $sw = $(sprintf('<div class="gcxSwitchType" data-gcx="%d"><h4>GCX %d<h4></h4></div>', i, i+1)).appendTo($wrapper);
            for(var j = 0; j < NUM_GCX_SWITCHES; j++){
                buildSwitch(i, j);
            }
        }

        $(document).trigger('config:numGCX:change', [{numGCX: +$(this).val()}]);


    }).val(gcp.config.numGCX);

    $base.find('.instantAccessBtn').each(function(){
        var $btn = $(this);
        var btnNum = +$btn.attr('data-btn');

        var renderFcnDetail = function(){

            var $detailSel = $btn.find('.switchFunctionDetail');

            $detailSel.html("");

            if(gcp.config.switchFunctions[btnNum] < 4){
                // GCX Loop #
                for(var i = 0; i < NUM_GCX_LOOPS; i++){
                    $(sprintf('<option value="%d">GCX Loop %d</option>', i, i+1)).appendTo($detailSel);
                }

                if(gcp.config.switchFunctionDetails[btnNum] >= NUM_GCX_LOOPS) {
                    gcp.config.switchFunctionDetails[btnNum] = 0;
                }

                $btn.find('.switchFunctionDetail').parent().show();
                $btn.find('.transmitCC').parent().hide();
                $btn.find('.switchType').parent().hide();

            } else if(gcp.config.switchFunctions[btnNum] == 4) {
                // Seq start/stop
                $btn.find('.switchFunctionDetail').parent().hide();
                $btn.find('.transmitCC').parent().hide();
                $btn.find('.switchType').parent().hide();

            } else {
                // MIDI Controller #
                for (var i = 0; i < 121; i++) {
                    $(sprintf('<option value="%d">MIDI Controller #%d</option>', i, i + 1)).appendTo($detailSel);
                }

                $btn.find('.switchFunctionDetail').parent().hide();
                $btn.find('.transmitCC').parent().show();
                $btn.find('.switchType').parent().show();
            }

            $detailSel.val(gcp.config.switchFunctionDetails[btnNum]);
        };

        renderFcnDetail();

        $btn.find('.switchFunction').change(function(){
            gcp.config.switchFunctions[btnNum] = +$(this).val();
            renderFcnDetail();
        }).val(gcp.config.switchFunctions[btnNum]);

        $btn.find('.switchFunctionDetail').change(function(){
            gcp.config.switchFunctionDetails[btnNum] = +$(this).val();
        }).val(gcp.config.switchFunctionDetails[btnNum]);

        $btn.find('.transmitCC').change(function(){
            gcp.config.switchTransmitCC[btnNum] = +$(this).val();
        }).val(gcp.config.switchTransmitCC[btnNum]);

        $btn.find('.switchType').change(function(){
            gcp.config.switchType[btnNum] = +$(this).val();
        }).val(gcp.config.switchType[btnNum]);
    });

    $base.find('.programAccessMode').change(function(){
        gcp.config.programAccessMode = +$(this).val();
        $(document).trigger('config:programAccessMode:change', [{}]);
    }).val(gcp.config.programAccessMode);

    $base.find('.directorySpeed').change(function(){
        gcp.config.directorySpeed = +$(this).val();
    }).val(gcp.config.directorySpeed);

    $base.find('.programReceiveChannel').change(function(){
        gcp.config.programChangeReceiveChannel = +$(this).val();
    }).val(gcp.config.programChangeReceiveChannel);

    $base.find('.softOptions_respond').click(function(){
        if($(this).prop('checked')) {
            gcp.config.softOptions.setRespond(1);
        } else {
            gcp.config.softOptions.setRespond(0);
        }
    }).val(gcp.config.softOptions.getRespond());

    $base.find('.softOptions_global').change(function(){
        gcp.config.softOptions.setGlobalProgram(+$(this).val());
    }).val(gcp.config.softOptions.getGlobalProgram());

    $base.find('.softOptions_linkMode').change(function(){
        gcp.config.softOptions.setLinkMode(+$(this).val());
    }).val(gcp.config.softOptions.getLinkMode());
}