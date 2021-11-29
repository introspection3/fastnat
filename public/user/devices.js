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

function uuid(len) {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let uuid = [],
        i;
    let radix = chars.length;
    // Compact form
    for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
    return uuid.join('');
}
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
    tunnelUrl = '/tunnel/add';



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
    return '<span title=\"' + value + '\">' + value + '</span>';
}

function formateVisit(value, row, index) {
    if (row.type === 'http' || row.type === 'https') {
        let link = `<a target='_blank' href="${window.location.protocol+'//'+window.location.hostname+':'+value}">${value}</a>`;
        return link;
    }
    return value;

}

function getDetail(index, selectdata) {
    if (selectdata) {
        let title = `设备[${selectdata.clientName}]的映射列表`;
        $('#tableDevicesTunnel').datagrid('reload', {
            id: selectdata.id
        });
        document.querySelectorAll('div .panel-title')[1].innerHTML = title;

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
    var value = new moment(now).format('YYYY-MM-DD HH:mm:ss');
    return '<span title=\"' + value + '\">' + value + '</span>';
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
    text: '复制Key',
    id: 'toolbarDeviceCopy',
    iconCls: 'icon-copy',
    handler: function() {
        let index = getGridRowIndex('tableDevices');
        if (index == -1) {
            $.messager.alert('提示', '请选择需要复制的设备');
            return;
        }
        let row = $('#tableDevices').datagrid("getSelections")[0];
        let authenKey = row.authenKey;
        var oInput = document.createElement('input');
        oInput.value = authenKey;
        document.body.appendChild(oInput);
        oInput.select(); // 选择对象
        document.execCommand("Copy"); // 执行浏览器复制命令
        oInput.className = 'oInput';
        oInput.style.display = 'none';
        $.messager.alert('提示', '复制成功,<br/>接下来请粘贴到程序中!', 'info');

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

        $.messager.confirm("警告", "删除设备意味着您所有的映射将删除,所以不建议您删除,你确定要继续吗?", function(data) {
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
            let title = `设备[${row.clientName}]的映射列表`;
            document.querySelectorAll('div .panel-title')[1].innerHTML = title;

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
        $('#uniqueName').textbox('setValue', uuid(16));
        $("input[type='radio' ][name='type' ][value='tcp' ]").prop('checked', 'true');
    }
}, {
    text: '编辑',
    id: 'toolbarTunnelEdit',
    iconCls: 'icon-edit',
    handler: function() {
        $('#dialogTunnel').dialog('open').dialog('setTitle', '编辑映射');
        let row = $('#tableDevicesTunnel').datagrid('getSelected');
        tunnelUrl = '/tunnel/update'
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
        $.messager.confirm("操作提示", "确定要删除此映射吗？", function(data) {
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
        url: tunnelUrl,
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
                return;
            }
            $('#tableDevicesTunnel').datagrid('reload');
            $('#dialogTunnel').dialog('close');
        }
    });
}