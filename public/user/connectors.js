function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) { return pair[1]; }
    }
    return (false);
}

var _clientId = getQueryVariable('id') * 1;
var _tunneId = -1;
var _connectorUrl = '/connector/add';

$(function() {
    $("#toolbarConnectorEdit").linkbutton("disable");
    $("#toolbarConnectorDelete").linkbutton("disable");
    closeDialog('dialogConnector');
});

function closeDialog(id) {
    $('#' + id).dialog('close');
}


function onSelectConnector(rowIndex, rowData) {
    $("#toolbarConnectorEdit").linkbutton("enable");
    $("#toolbarConnectorDelete").linkbutton("enable");
    _tunneId = rowData.id;
}

function fixWidth(percent) {
    return percent;
}

var tabTitle = '';

function operateFunction(value, row, index) {
    var title = '[${row.clientName}]连接的P2P映射';
    title = title.replace("${row.clientName}", row.clientName);
    tabTitle = title;
    var ret = '<a href="#" onclick="openConnector(${row.id})">P2P映射</a>';
    ret = ret.replace("${row.id}", row.id);
    return ret;
}

function tooLongText(value, row, index) {
    return '<span title=' + value + '>' + value + '</span>'
}

function getDetail(index, selectdata) {
    if (selectdata) {
        $('#tableDevicesConnector').datagrid('reload', {
            id: selectdata.id
        });
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
    return new moment(now).format('YYYY-MM-DD HH:mm:ss');
}

var toolbarConnector = [{
    text: '添加',
    id: 'toolbarConnectorAdd',
    iconCls: 'icon-add',
    handler: function() {
        $('#dialogConnector').dialog('open').dialog('setTitle', '添加连接');
        $('#fm').form('clear');
    }
}, {
    text: '编辑',
    id: 'toolbarConnectorEdit',
    iconCls: 'icon-edit',
    handler: function() {
        $('#dialogConnector').dialog('open').dialog('setTitle', '编辑映射');
        var row = $('#tableDevicesConnector').datagrid('getSelected');
        _connectorUrl = '/connector/update'
        $('#fm').form('load', row);
    }
}, {
    text: '删除',
    id: 'toolbarConnectorDelete',
    iconCls: 'icon-cut',
    handler: function() {
        var index = getGridRowIndex('tableDevicesConnector');
        if (index == -1) {
            $.messager.alert('提示', '请选择需要删除映射');
            return;
        }
        $.messager.confirm("操作提示", "您确定要删除此映射吗？", function(data) {
            if (data) {
                var id = $('#tableDevicesConnector').datagrid("getSelections")[0].id;
                $.post('/connector/delete', {
                    id: id,
                    clientId: _clientId
                }, function(result) {
                    $('#tableDevicesConnector').datagrid('reload');
                });
            }
        });
    }
}];


function saveConnector() {
    $('#fm').form('submit', {
        url: _connectorUrl,
        onSubmit: function() {
            var v = $(this).form('validate');
            $('#clientId').val(_clientId);
            $('#id').val(_tunneId);
            return v;
        },
        success: function(result) {
            result = JSON.parse(result);
            $('#dialogConnector').dialog('close');
            if (result.success == false) {
                $.messager.alert('提示', result.info);
                return;
            }
            $('#tableDevicesConnector').datagrid('reload');
        }
    });
}