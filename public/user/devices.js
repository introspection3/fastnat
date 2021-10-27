$(function() {
    $("#toolbarDeviceERedo").linkbutton("disable");
    $("#toolbarDeviceEdit").linkbutton("disable");
    $("#toolbarDeviceDelete").linkbutton("disable");
    $("#toolbarDeviceSave").linkbutton("disable");
    $("#toolbarTunnelAdd").linkbutton("disable");
    $("#toolbarTunnelEdit").linkbutton("disable");
    $("#toolbarTunnelDelete").linkbutton("disable");
    closeDialog('dialogTunnel');
});

let _clientId = -1;
let _tunneId = -1;
let tunnelUrl = '/tunnel/add';

function closeDialog(id) {
    $('#' + id).dialog('close');
}

function onSelectDevice(rowIndex, rowData) {
    $("#toolbarDeviceEdit").linkbutton("enable");
    $("#toolbarDeviceDelete").linkbutton("enable");
    _clientId = rowData.id;
    $("#toolbarTunnelAdd").linkbutton("enable");
    _connectorUrl = '/tunnel/add'

}

function onSelectTunnel(rowIndex, rowData) {
    $("#toolbarTunnelEdit").linkbutton("enable");
    $("#toolbarTunnelDelete").linkbutton("enable");
    _tunneId = rowData.id;
}

function fixWidth(percent) {
    return percent;
}


function operateFunction(value, row, index) {
    let title = `[${row.clientName}]P2P连接`;
    let tabTitle = encodeURI(title);
    return `<a href="#" onclick="openConnector(${row.id},'${tabTitle}')">P2P连接</a>`;
}

function openConnector(clientId, tabTitle) {
    let href = '/user/connectors.html?id=' + clientId;
    let title = decodeURI(tabTitle);
    parent.addTab(title, href);
}

function tooLongText(value, row, index) {
    return '<span title=' + value + '>' + value + '</span>'
}

function getDetail(index, selectdata) {
    if (selectdata) {
        $('#tableDevicesTunnel').datagrid('reload', {
            id: selectdata.id
        });
    }
}

function getGridRowIndex(id) {
    let rows = $('#' + id).datagrid("getSelections");
    if (rows.length == 0) {
        return -1;
    }
    let index = $('#' + id).datagrid("getRowIndex", rows[0]);
    return index;
}

function formatDateTime(val, row) {
    var now = new Date(val);
    return new moment(now).format('YYYY-MM-DD HH:mm:ss');
}
let toolbarDeviceEditRow = null;
let toolbarDevice = [{
    text: '添加',
    id: 'toolbarDeviceAdd',
    iconCls: 'icon-add',
    handler: function() {
        $.messager.defaults = {
            ok: "确定",
            cancel: "取消"
        };
        $.messager.prompt('新建客户端', '请输入客户端名:', function(r) {
            if (r) {
                $.post('/client/add', {
                    clientName: r
                }, function(result) {
                    if (result.success) {
                        $('#tableDevices').datagrid("reload");
                    } else {
                        $.messager.alert('提示', result.info);
                    }
                });
            }
        });
    }
}, {
    text: '编辑',
    id: 'toolbarDeviceEdit',
    iconCls: 'icon-edit',
    handler: function() {
        let index = getGridRowIndex('tableDevices');
        if (index == -1) {
            $.messager.alert('提示', '请选择需要编辑的设备');
            return;
        }
        $("#toolbarDeviceERedo").linkbutton("enable");
        $("#toolbarDeviceSave").linkbutton("enable");
        $('#tableDevices').datagrid('beginEdit', index);

    }
}, {
    text: '取消编辑',
    id: 'toolbarDeviceERedo',
    iconCls: 'icon-redo',
    handler: function() {
        $('#tableDevices').datagrid("rejectChanges");
        $("#toolbarDeviceERedo").linkbutton("disable");
        $("#toolbarDeviceSave").linkbutton("disable");
    }
}, {
    text: '删除',
    iconCls: 'icon-clear',
    id: 'toolbarDeviceDelete',
    handler: function() {
        let index = getGridRowIndex('tableDevices');
        if (index == -1) {
            $.messager.alert('提示', '请选择需要删除的设备');
            return;
        }
        $.messager.defaults = {
            ok: "确定",
            cancel: "取消"
        };

        $.messager.confirm("操作提示", "您确定要删除此设备吗？", function(data) {
            if (data) {
                let id = $('#tableDevices').datagrid("getSelections")[0].id;
                $.post('/client/delete', {
                    id: id
                }, function(result) {
                    $('#tableDevices').datagrid('reload');
                });
            }
        });
    }
}, '-', {
    text: '保存',
    iconCls: 'icon-save',
    id: 'toolbarDeviceSave',
    handler: function() {
        let index = getGridRowIndex('tableDevices');
        if (index == -1) {
            $.messager.alert('提示', '请选择需要保存的设备');
            return;
        }
        $('#tableDevices').datagrid('endEdit', index);
        let row = $('#tableDevices').datagrid("getSelections")[0];
        if (row.clientName.trim() === '') {
            $.messager.alert('提示', '客户名称不能为空');
            return;
        }
        $.post('/client/update', {
            id: row.id,
            clientName: row.clientName
        }, function(result) {
            $('#tableDevices').datagrid('reload');
        });
    }
}];

let toolbarTunnel = [{
    text: '添加',
    id: 'toolbarTunnelAdd',
    iconCls: 'icon-add',
    handler: function() {
        $('#dialogTunnel').dialog('open').dialog('setTitle', '添加映射');
        $('#fm').form('clear');
        $('#localIp').textbox('setValue', '127.0.0.1');
        $('#p2pPassword').textbox('setValue', 'fastnat');
        $("input[type='radio' ][name='type' ][value='tcp' ]").prop('checked', 'true');
    }
}, {
    text: '编辑',
    id: 'toolbarTunnelEdit',
    iconCls: 'icon-edit',
    handler: function() {
        $('#dialogTunnel').dialog('open').dialog('setTitle', '编辑映射');
        let row = $('#tableDevicesTunnel').datagrid('getSelected');
        _connectorUrl = '/tunnel/update'
        $('#fm').form('load', row);
    }
}, {
    text: '删除',
    id: 'toolbarTunnelDelete',
    iconCls: 'icon-cut',
    handler: function() {
        let index = getGridRowIndex('tableDevicesTunnel');
        if (index == -1) {
            $.messager.alert('提示', '请选择需要删除映射');
            return;
        }
        $.messager.confirm("操作提示", "您确定要删除此映射吗？", function(data) {
            if (data) {
                let id = $('#tableDevicesTunnel').datagrid("getSelections")[0].id;
                $.post('/tunnel/delete', {
                    id: id,
                    clientId: _clientId
                }, function(result) {
                    $('#tableDevicesTunnel').datagrid('reload');
                });
            }
        });
    }
}];


function saveTunnel() {
    $('#fm').form('submit', {
        url: _connectorUrl,
        onSubmit: function() {
            let v = $(this).form('validate');
            $('#clientId').val(_clientId);
            $('#id').val(_tunneId);
            return v;
        },
        success: function(result) {
            result = JSON.parse(result);
            if (result.success == false) {
                $.messager.alert('提示', result.info);
                $('#dialogTunnel').dialog('close');
                return;
            }
            $('#tableDevicesTunnel').datagrid('reload');
        }
    });
}