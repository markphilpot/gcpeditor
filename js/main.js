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
});

function init(){
    var $base = $('#gcp');

    var $deviceConfig = $base.find('#configPanel .device');

    for(var i = 1; i < NUM_DEVICES; i++){
        var $clone = $deviceConfig.clone().appendTo($('#devices'));

        $clone.attr('data-device', i);
        $clone.find('span.device_enabled_title').html(sprintf("Device #%d", i+1));
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
        var pNum = $p.attr('data-preset');

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

        $(document).on('config:deviceName:change config:deviceEnabled:change presets:copy', function(event, data){
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



}