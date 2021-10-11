$(function() {
    let config = {
        addDeviceForm: {
            header: '新建设备',
            name: 'addDeviceForm',
            fields: [
                { name: 'nome', type: 'text', required: true, html: { caption: 'Nome', attr: 'size="40" maxlength="40"' } },
                { name: 'cognome', type: 'text', required: true, html: { caption: 'Cognome', attr: 'size="40" maxlength="40"' } },
                { name: 'dataNascita', type: 'text', html: { caption: 'Data Nascita', attr: 'size="10"' }, render: 'date:dd/mm/yyyy' },
                { name: 'cittaResidenza', type: 'text', html: { caption: 'Residenza', attr: 'size="30"' } }
            ],
            actions: {
                Reset: function() {
                    this.clear();
                },
                Save: function() {
                    var errors = this.validate();
                    if (errors.length > 0) return;

                }
            }
        }
    }
    $().w2form(config.addDeviceForm);
    $('#grid1').w2grid({
        name: 'grid1',
        url: '/user/clients',
        header: '我的设备列表',
        show: {
            header: true,
            lineNumbers: true,
            selectColumn: true,
            toolbar: true,
            footer: true,
            toolbarAdd: true,
            toolbarDelete: true,
            toolbarSave: true,
        },

        searches: [{
            field: 'clientName',
            label: '设备名称 ',
            type: 'text'
        }, {
            field: 'authenKey',
            label: '设备Key',
            type: 'text'
        }],
        columns: [{
            field: 'id',
            text: 'ID',
            size: '50px',
            sortable: true,
            attr: 'align=center',
            resizable: true
        }, {
            field: 'clientName',
            text: '设备名称',
            size: '10%',
            sortable: true,
            resizable: true,
            editable: {
                type: 'text'
            }
        }, {
            field: 'authenKey',
            text: '设备Key',
            size: '10%',
            sortable: true,
            resizable: true
        }, {
            field: 'os',
            text: '设备信息',
            size: '15%',
            resizable: true
        }, {
            field: 'virtualIp',
            text: '设备Ip',
            size: '5%',
            resizable: true
        }, {
            field: 'publicIp',
            text: '出口IP',
            size: '5%',
            resizable: true
        }, {
            field: 'mac',
            text: 'MAC地址',
            size: '5%',
            resizable: true
        }, {
            field: 'natType',
            text: 'Nat类型',
            size: '5%',
            resizable: true
        }, {
            field: 'createdAt',
            text: '创建时间',
            type: 'datetime',
            size: '10%',
            resizable: true
        }, {
            field: 'updatedAt',
            text: '更新时间',
            type: 'datetime',
            size: '10%',
            resizable: true
        }],
        onAdd: function(event) {
            w2popup.open({
                title: '新增设备',
                body: '<div id="addDeviceDiv" style="position: absolute; left: 5px; top: 5px; right: 5px; bottom: 5px;"></div>',
                actions: {
                    Ok(event) {
                        w2popup.close()
                    },
                    Cancel(event) {
                        w2popup.close()
                    }
                },
                onOpen: function(event) {
                    let op = this;
                    event.onComplete = function() {
                        w2ui.content('addDeviceDiv', w2ui.addDeviceForm);
                    };
                },
                onToggle: function(event) {
                    event.onComplete = function() {
                        w2ui.resize();
                    };
                }
            });
        },
        onEdit: function(event, eventData) {
            var sel = w2ui['grid'].getSelection();

            console.log(JSON.stringify(sel));
            w2alert('edit');
        },
        onDelete: function(event) {
            console.log(JSON.stringify(event));
        },
        onSave: function(event) {
            w2alert('save');
        },
        onSelect: function(event) {
            console.log(JSON.stringify(event))
            let grid = this;
            let info = grid.get(event.recid).clientName + ':对应的映射信息';
            w2ui['grid2'].header = info;
            w2ui['grid2'].refresh();

        }
    });



    $('#grid2').w2grid({
        name: 'grid2',
        header: '设备映射信息',
        show: {
            header: true,
            lineNumbers: true,
            selectColumn: true,
            toolbar: true,
            footer: true,
            toolbarAdd: true,
            toolbarDelete: true,
            toolbarSave: true,
        },
        columns: [{
            field: 'recid',
            text: 'ID',
            size: '50px',
            sortable: true,
            attr: 'align=center'
        }, {
            field: 'name',
            text: '名称',
            size: '5%',
            sortable: true
        }, {
            field: 'createdAt',
            text: '网路唯一名',
            type: 'text',
            size: '5%',
            resizable: true
        }, {
            field: 'type',
            text: '映射类型',
            size: '5%',
            sortable: true
        }, {
            field: 'other',
            text: '其余信息',
            size: '10%'
        }, {
            field: 'p2pPassword',
            text: 'p2p密码',
            size: '10%'
        }, {
            field: 'localIp',
            text: '本地Ip',
            size: '5%'
        }, {
            field: 'localPort',
            text: '本地端口',
            type: 'number',
            size: '3%'
        }, {
            field: 'remotePort',
            text: '对外端口',
            type: 'number',
            size: '3%'
        }, {
            field: 'createdAt',
            text: '创建时间',
            type: 'datetime',
            size: '5%',
            resizable: true
        }, {
            field: 'updatedAt',
            text: '更新时间',
            type: 'datetime',
            size: '5%',
            resizable: true
        }],
        onClick: function(event) {
            let grid = this;
            grid.get(event.recid)

        }
    });




});