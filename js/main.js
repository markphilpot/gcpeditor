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

        if($(this).attr('data-next') == 'done') {
            $(this).attr('data-next', 'copy');
            $(this).html("Done");

            $('#presetPanel .preset').each(function () {
                var $p = $(this);
                var pNum = $p.attr('data-preset');

                var $cp = $('<button class="copy-p btn btn-default" type="button">Copy..</button>').appendTo($p.find('form'));

                $cp.click(function(){
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
        } else {
            $(this).attr('data-next', 'done');
            $(this).html("Copy Presets");
            $('.copy-p').remove();
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

    var $bankList = $base.find('#presetPanel .tab-content');
    var $bankNav = $base.find('#presetPanel .nav-tabs');

    var $preset = $base.find('#presetPanel .preset');

    var banks = [];
    var bankLabels = "0123456789ABCDEFGHIJ";
    for(var i = 0; i < NUM_BANKS; i++ ){
        if(i != 0){
            $(sprintf('<li role="presentation"><a href="#bank%d" aria-controls="presets" role="tab" data-toggle="tab">%s</a></li>', i, bankLabels[i])).appendTo($bankNav);
            $(sprintf('<div role="tabpanel" class="tab-pane" id="bank%d"></div>', i)).appendTo($bankList);
        }

        banks[i] = $(sprintf('#bank%d', i));
    }

    for(var i = 0; i < NUM_PRESETS; i++){
        if(i == 0){
            continue;
        }

        var $clone = $preset.clone().appendTo(banks[Math.floor(i/10)]);

        $clone.attr('data-preset', i);
        $clone.find('.preset-label-num').html(i);
    }
}

function render(){
    renderConfig();
    renderPreset();
}

function renderPreset(){

    var $base = $('#gcp');

    $base.find("#presetPanel .preset").each(function(){
        var $p = $(this);
        var pNum = +$p.attr('data-preset');

        var sync = function(){
            $p.find('.presetName').val(gcp.presets[pNum].name);

            var $changes = $p.find('.deviceProgramChanges');

            $changes.html("");

            for(var i = 0; i < NUM_DEVICES; i++){
                if(gcp.config.isDeviceEnabled(i)){
                    var $d = $(sprintf('<div class="checkbox"><label><input type="checkbox" class="preset_device_enabled" data-device="%d"> <span class="preset_device_enabled_title">%s</span></label></div>', i, gcp.config.deviceNames[i])).appendTo($changes);

                    $d.find('input').prop('checked', gcp.presets[pNum].deviceProgramChanges[i].onOff != 0);

                    var $input = $(sprintf('<input type="text" class="preset_device_change form-control" data-device="%d" size="3"/>', i)).appendTo($changes);

                    $input.val(gcp.presets[pNum].deviceProgramChanges[i].pc);
                }
            }
        };

        $(document).on('config:deviceName:change config:deviceEnabled:change presets:copy presets:import', function(event, data){
            sync();
        });

        $p.find('.preset_device_enabled').click(function(){
            var dNum = $(this).attr('data-device');
            if($(this).prop('checked')){
                gcp.presets[pNum].deviceProgramChanges[dNum].onOff = 1;
            } else {
                gcp.presets[pNum].deviceProgramChanges[dNum].onOff = 0;
            }
        });

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

        $(document).on('config:pedalExists:change', function(event, data){
            if(gcp.config.pedalsExist[0] == 1 || gcp.config.pedalsExist[1] == 1) {
                $p.find('.presetPedals button').show();
            } else {
                $p.find('.presetPedals button').hide();
            }
        });

        $(document).on('config:numGCX:change', function(event, data){
            if(gcp.config.numGCX > 0){
                $p.find('.loopStates button').show();
            } else {
                $p.find('.loopStates button').hide();
            }
        });

        $p.find('.presetPedals button').click(function(){
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

        $p.find('.loopStates button').click(function(){
            var $dialog = $('<div/>').appendTo($('body'));

            var buildLS = function(ls, $w, gcx){
                var $wrapper = $('<div class="form-group"></div>').appendTo($w);
                var $label = $(sprintf('<label>GCX %d Loop %d State </label>', gcx+1, ls+1)).appendTo($wrapper);
                var $sel = $('<select class="form-control"><option value="0">Off</option><option value="1">On</option></select>').appendTo($label);

                $sel.change(function(){
                    gcp.presets[pNum].gcxLoopStates[gcx*NUM_GCX_LOOPS+ls] = +$(this).val();
                }).val(gcp.presets[pNum].gcxLoopStates[gcx*NUM_GCX_LOOPS+ls]);
            };

            var buildGCX = function(gcx){
                var $gcxWrapper = $('<div class="gcxLoopState"/>').appendTo($dialog);
                $(sprintf('<h4>GCX %d</h4>', gcx+1)).appendTo($gcxWrapper);
                var $wrapper = $('<div class="form-group"></div>').appendTo($gcxWrapper);

                var $label = $('<label>Send GCX Data </label>').appendTo($wrapper);
                var $sel = $('<select class="form-control"><option value="0">Yes</option><option value="1">No</option></select>').appendTo($label);

                $sel.change(function(){
                    gcp.presets[pNum].gcxToggles[gcx] = +$(this).val();
                }).val(gcp.presets[pNum].gcxToggles[gcx]);

                for(var i = 0; i < NUM_GCX_LOOPS; i++){
                    buildLS(i, $gcxWrapper, gcx);
                }
            };

            for(var i = 0; i < gcp.config.numGCX; i++){
                buildGCX(i);
            }

            $dialog.dialog({
                title: sprintf('Preset %d GCX Loop Configuration', pNum),
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

        $p.find('.iaStates button').click(function(){
            var $dialog = $('<div/>').appendTo($('body'));

            var buildIa = function(ia){
                var $wrapper = $('<div class="form-group"></div>').appendTo($dialog);
                var $label = $(sprintf('<label>Instant Access %d State </label>', ia+1)).appendTo($wrapper);
                var $sel = $(sprintf('<select class="form-control" data-ia="%d"><option value="0">Off</option><option value="1">On</option></select>', ia)).appendTo($label);

                $sel.change(function(){
                    gcp.presets[pNum].instantAccessState[ia] = +$(this).val();
                }).val(gcp.presets[pNum].instantAccessState[ia]);
            };

            for(var i = 0; i < NUM_INSTANT_ACCESS; i++){
                buildIa(i);
            }

            $dialog.dialog({
                title: sprintf('Preset %d Instant Access States', pNum),
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

        sync();
    });
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

    $base.find('.pedal').change(function(){
        var p = +$(this).attr('data-pedal');
        gcp.config.pedalsExist[p] = +$(this).val();
        $(document).trigger("config:pedalExists:change", [{pedal: p, exists: +$(this).val()}]);
    }).each(function(){
        var p = +$(this).attr('data-pedal');
        $(this).val(gcp.config.pedalsExist[p]);
    });

    $base.find('.vca').change(function(){
        gcp.config.vcaExists = +$(this).val();
    }).each(function(){
        $(this).val(gcp.config.vcaExists);
    });

    $base.find('.numGCX').change(function(){
        gcp.config.numGCX = +$(this).val();

        var $wrapper = $('.gcxSwitchTypes');
        $wrapper.html("");

        for(var i = 0; i < gcp.config.numGCX; i++){
            var $sw = $(sprintf('<div class="gcxSwitchType" data-gcx="%d"><h4>GCX %d<h4></h4></div>', i, i+1)).appendTo($wrapper);
            for(var j = 0; j < NUM_GCX_SWITCHES; j++){
                var $label = $(sprintf('<label>Switch %d</label>', j+1)).appendTo($sw);
                var $sel = $('<select class="form-control"><option value="0">Latching</option><option value="1">Momentary</option></select>').appendTo($label);
                $sel.change(function(){
                    gcp.config.gcxSwitchTypes[i*NUM_GCX_SWITCHES+j] = +$(this).val();
                }).val(gcp.config.gcxSwitchTypes[i*NUM_GCX_SWITCHES+j]);
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

            } else {
                // MIDI Controller #
                for (var i = 0; i < 121; i++) {
                    $(sprintf('<option value="%d">MIDI Controller #%d</option>', i, i + 1)).appendTo($detailSel);
                }
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