$(function() {
    $("#toolbarDeviceERedo").linkbutton("disable");
    $("#toolbarDeviceEdit").linkbutton("disable");
    $("#toolbarDeviceDelete").linkbutton("disable");
    $("#toolbarDeviceSave").linkbutton("disable");
    $("#toolbarTunnelAdd").linkbutton("disable");
    $("#toolbarTunnelAddFileBrowser").linkbutton("disable");
    $("#toolbarTunnelEdit").linkbutton("disable");
    $("#toolbarTunnelDelete").linkbutton("disable");
    closeDialog('dialogTunnel');
});

function uuid(len) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var uuid = [],
        i;
    var radix = chars.length;
    // Compact form
    for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
    return uuid.join('');
}
var _clientId = -1;
var _tunneId = -1;
var tunnelUrl = '/tunnel/add';

function closeDialog(id) {
    $('#' + id).dialog('close');
}

function onSelectDevice(rowIndex, rowData) {
    $("#toolbarDeviceEdit").linkbutton("enable");
    $("#toolbarDeviceDelete").linkbutton("enable");
    _clientId = rowData.id;
    $("#toolbarTunnelAdd").linkbutton("enable");
    $("#toolbarTunnelAddFileBrowser").linkbutton("enable");
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
    var title = '[${row.clientName}]P2P连接';
    title = title.replace('${row.clientName}', row.clientName);
    var tabTitle = encodeURI(title);
    var ret = '<a href="#" onclick="openConnector(${row.id},\'${tabTitle}\')">P2P</a>';
    ret = ret.replace("${row.id}", row.id);
    ret = ret.replace("${tabTitle}", tabTitle);
    return ret;
}

function openConnector(clientId, tabTitle) {
    var href = '/user/connectors.html?id=' + clientId;
    var title = decodeURI(tabTitle);
    parent.addTab(title, href);
}

function tooLongText(value, row, index) {
    return '<span title=\'' + value + '\'>' + value + '</span>';
}

function formateVisit(value, row, index) {
    if (row.type === 'http' || row.type === 'https') {
        var hrefStr = window.location.protocol + '//' + window.location.hostname + ':' + value;
        var link = '<a target="_blank" href="${hrefStr}">${value}</a>';
        link = link.replace('${hrefStr}', hrefStr);
        link = link.replace('${value}', value);
        return link;
    }
    return value;
}

function formateVisitUnique(value, row, index) {

    var domainName = systemInfo.http.domain;
    var hrefStr = '';
    if (row.type === 'http') {
        hrefStr = 'http://' + value + '.' + domainName + ":" + systemInfo.http.port;
    } else if (row.type === 'https') {
        rhrefStresult = 'https://' + value + '.' + domainName + ":" + systemInfo.http.sslPort;
    } else {
        return value;
    }

    var link = '<a target="_blank" href="${hrefStr}">${value}</a>';
    link = link.replace('${hrefStr}', hrefStr);
    link = link.replace('${value}', value);

    return link;
}

function formatSystem(value, row, index) {
    if (value != null && value != '') {
        return value + ':' + row.arch;
    }
    return value;
}

function getDetail(index, selectdata) {
    if (selectdata) {
        var title = '设备[${selectdata.clientName}]的映射列表';
        title = title.replace('${selectdata.clientName}', selectdata.clientName)
        $('#tableDevicesTunnel').datagrid('reload', {
            id: selectdata.id
        });
        document.querySelectorAll('div .panel-title')[1].innerHTML = title;

    }
}

function getGridRowIndex(id) {
    var rows = $('#' + id).datagrid("getSelections");
    if (rows.length == 0) {
        return -1;
    }
    var index = $('#' + id).datagrid("getRowIndex", rows[0]);
    return index;
}

function formatDateTime(val, row) {
    var now = new Date(val);
    var value = new moment(now).format('YYYY-MM-DD HH:mm:ss');
    return '<span title=\"' + value + '\">' + value + '</span>';
}
var toolbarDeviceEditRow = null;
var toolbarDevice = [{
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
            var index = getGridRowIndex('tableDevices');
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
            var index = getGridRowIndex('tableDevices');
            if (index == -1) {
                $.messager.alert('提示', '请选择需要复制的设备');
                return;
            }
            var row = $('#tableDevices').datagrid("getSelections")[0];
            var authenKey = row.authenKey;
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
            var index = getGridRowIndex('tableDevices');
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
                    var id = $('#tableDevices').datagrid("getSelections")[0].id;
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
            var index = getGridRowIndex('tableDevices');
            if (index == -1) {
                $.messager.alert('提示', '请选择需要保存的设备');
                return;
            }
            $('#tableDevices').datagrid('endEdit', index);
            var row = $('#tableDevices').datagrid("getSelections")[0];
            if (row.clientName.trim() === '') {
                $.messager.alert('提示', '客户名称不能为空');
                return;
            }
            $.post('/client/update', {
                id: row.id,
                clientName: row.clientName
            }, function(result) {
                $('#tableDevices').datagrid('reload');
                var title = '设备[${row.clientName}]的映射列表';
                title = title.replace('${row.clientName}', row.clientName);
                document.querySelectorAll('div .panel-title')[1].innerHTML = title;

            });
        }
    },

    {
        text: '',
        iconCls: 'icon-help',
        id: 'toolbarHelp',
        handler: function() {
            var msg = '一个电脑(或手机)就是一个设备,在电脑(或手机)上安装本软件时,录入下方一个KEY即可';
            $.messager.alert('提示', msg, 'info', function() {

            });

        }
    },
];
``

var toolbarTunnel = [{
        text: '添加',
        id: 'toolbarTunnelAdd',
        iconCls: 'icon-add',
        handler: function() {
            tunnelUrl = '/tunnel/add';
            $('#dialogTunnel').dialog('open').dialog('setTitle', '添加映射');
            $('#fm').form('clear');
            $('#localIp').textbox('setValue', '127.0.0.1');
            $('#p2pPassword').textbox('setValue', 'fastnat');
            $('#uniqueName').textbox('setValue', uuid(16));
            $("input[type='radio' ][name='type' ][value='tcp' ]").prop('checked', 'true');
        }
    },
    {
        text: '本地文件管理',
        id: 'toolbarTunnelAddFileBrowser',
        iconCls: 'icon-add',
        handler: function() {
            tunnelUrl = '/tunnel/add';
            $('#dialogTunnel').dialog('open').dialog('setTitle', '创建本地文件管理(默认账号:admin,设备key)');
            $('#fm').form('clear');
            $('#tunnelName').textbox('setValue', '本地文件管理');
            $('#localIp').textbox('setValue', '127.0.0.1');
            $('#localPort').textbox('setValue', '7777');
            $('#p2pPassword').textbox('setValue', 'fastnat');
            $('#uniqueName').textbox('setValue', uuid(16));
            $("input[type='radio' ][name='type' ][value='http' ]").prop('checked', 'true');
        }
    },
    {
        text: '编辑',
        id: 'toolbarTunnelEdit',
        iconCls: 'icon-edit',
        handler: function() {
            $('#dialogTunnel').dialog('open').dialog('setTitle', '编辑映射');
            var row = $('#tableDevicesTunnel').datagrid('getSelected');
            tunnelUrl = '/tunnel/update';
            $('#fm').form('load', row);
        }
    }, {
        text: '删除',
        id: 'toolbarTunnelDelete',
        iconCls: 'icon-clear',
        handler: function() {
            var index = getGridRowIndex('tableDevicesTunnel');
            if (index == -1) {
                $.messager.alert('提示', '请选择需要删除映射');
                return;
            }
            $.messager.confirm("操作提示", "确定要删除此映射吗？", function(data) {
                if (data) {
                    var id = $('#tableDevicesTunnel').datagrid("getSelections")[0].id;
                    $.post('/tunnel/delete', {
                        id: id,
                        clientId: _clientId
                    }, function(result) {
                        $('#tableDevicesTunnel').datagrid('reload');
                    });
                }
            });
        }
    }
];


function saveTunnel() {
    $('#fm').form('submit', {
        url: tunnelUrl,
        onSubmit: function() {
            var v = $(this).form('validate');
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