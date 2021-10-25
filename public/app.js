 function isIE() { //ie?  
     if (!!window.ActiveXObject || "ActiveXObject" in window)
         return true;
     else
         return false;
 }

 //定义全局变量
 let app = {};
 let user = {};
 //全局格式化
 let globalFormatters = {
     //用户
     user: function(value) {

         return '';
     },
     orderStatus: function(value) {
         return app.dictionarys['OrderStatus'][value];
     }
 };
 //全局筛选
 let globalFilters = {
     user: function(field) {
         return {
             field: field,
             type: 'combobox',
             valueType: 'GUID',
             options: { data: app.users, valueField: 'UserId', textField: 'UserName' },
             op: 'equal'
         }
     },
     date: function(field) {
         return {
             field: field,
             type: 'datebox',
             valueType: 'datebox',
             op: ['equal', 'notequal', 'less', 'greater']
         }
     },
     numeric: function(field) {
         return {
             field: field,
             type: 'numberspinner',
             valueType: 'numeric',
             op: ['equal', 'notequal', 'less', 'greater']
         }
     },
     combo: function(field, dg, dictionaryCategory) {
         let dictionarys = app.dictionarys[dictionaryCategory || field];
         let data = [{ value: '', text: 'All' }];
         for (let value in dictionarys) {
             data.push({ value: value, text: dictionarys[value] });
         }

         return {
             field: field,
             type: 'combobox',
             options: {
                 panelHeight: 'auto',
                 data: data,
                 onChange: function(value) {
                     if (value == '') {
                         dg.datagrid('removeFilterRule', field);
                     } else {
                         dg.datagrid('addFilterRule', {
                             field: field,
                             op: 'equal',
                             type: 'numeric',
                             value: value
                         });
                     }
                     dg.datagrid('doFilter');
                 }
             }
         }
     }
 };
 //全局列
 let globalColumns = [
     { field: 'CreatorUserId', title: '创建人', hidden: true, width: 120, sortable: true },
     { field: 'CreationTime', title: '创建时间', hidden: true, width: 130, sortable: true },
     { field: 'LastModifierUserId', title: '修改人', hidden: true, width: 120, sortable: true, formatter: globalFormatters.user },
     { field: 'LastModificationTime', title: '修改时间', hidden: true, width: 130, sortable: true }
 ];
 //全局列筛选
 let globalColumnsFilter = [
     globalFilters.user('CreatorUserId'),
     globalFilters.user('LastModifierUserId'),
     globalFilters.date('CreationTime'),
     globalFilters.date('LastModificationTime')
 ];

 $(document).ajaxSend(function(event, jqxhr, settings) {
     if (settings.url.indexOf('.cshtml') > 0) {
         showLoadding();
     }
 });
 $(document).ajaxStop(hideLoadding);
 $(document).ajaxError(function(event, jqXHR, ajaxSettings, thrownError) {
     //console.log([event, jqXHR, ajaxSettings, thrownError]);
     hideLoadding();
     if (jqXHR.status > 0) {
         showToast("抱歉，系统出现了错误，请联系管理员解决！");
     }
 });
 window.onerror = function() {
     hideLoadding();
 }

 //打开一个tab
 function opentab(plugin, title, buttons, record) {
     if ($('#mainTabs').tabs('exists', title)) {
         $('#mainTabs').tabs('select', title);
     } else {
         $('#mainTabs').tabs('add', {
             title: title,
             href: 'html/' + plugin + '.html',
             plugin: plugin,
             closable: true
         });
         $('.tabs-selected').data('buttons', buttons).data('record', record);
     }
 }

 //关闭当前打开的tab
 function closetab() {
     let curTab = $('#mainTabs').tabs("getSelected");
     let index = $('#mainTabs').tabs('getTabIndex', curTab);
     $('#mainTabs').tabs('close', index);
 }

 //显示loadding
 function showLoadding() {
     $('.ajax-loadding').show();
 }

 //隐藏loadding
 function hideLoadding() {
     $('.ajax-loadding').hide();
 }

 //提示
 function showToast(msg) {
     hideLoadding();
     $.messager.show({
         msg: msg,
         showType: 'slide',
         id: 'toast',
         height: 'auto',
         style: {
             top: 10
         }
     });
     $('#app-status').html('<label style="color:#f60;font-weight:bold;">' + msg + '</label>');
     setTimeout(function() {
         $('#app-status').text('Ready');
     }, 10000);
 }

 function renderInit() {
     if (isIE()) {
         $('#fullscreen').hide();
     } else {
         $('#fullscreen').show();
     }
 }

 //显示icon选择dialog
 function chooseIcons() {
     let textbox = $(this);
     let dlg = $('#dlg-main');

     if ($('#icons>a').size() <= 0) {
         dlg.dialog({
             title: 'Icon选择',
             modal: true,
             href: 'icons.html',
             cache: true,
             width: 600,
             height: 400,
             top: 120,
             onLoad: function() {
                 let box = $('#icons').empty();

                 $.getJSON('/api/get-icons', function(data) {
                     $.each(data, function(i, n) {
                         box.append('<a href="#" class="fa ' + n + '"></a>');
                     });

                     dlg.find('a').bind('click', function() {
                         let iconClass = $(this).attr('class').replace('fa ', '');
                         textbox.textbox('setValue', iconClass);

                         dlg.dialog('close');
                     });
                 });
             }
         });
     } else {
         dlg.dialog('open');
     }
 }

 //生成toolbar
 function createToolbar(me, dg) {
     let toolbar = [];
     $.each($('.tabs-selected').data('buttons'), function(i, n) {
         toolbar.push({
             id: dg.selector.replace('#', '') + '-' + n.ButtonLink,
             text: n.ButtonName,
             iconCls: 'fa ' + n.IconCls,
             handler: function() {
                 eval('me.options.' + n.ButtonLink + '(dg)');
             }
         });
     });
     if (me.options.toolbar != null) {
         $.each(me.options.toolbar, function(i, n) {
             toolbar.push(n);
         });
     }
     return toolbar.length == 0 ? null : toolbar;
 }

 //生成表头的右键菜单
 function createColumnMenu(dg) {
     let cmenu = $('<div />').appendTo(dg);
     cmenu.menu({
         onClick: function(item, field) {
             if (item.iconCls === 'icon-ok') {
                 dg.datagrid('hideColumn', item.name);
                 cmenu.menu('setIcon', {
                     target: item.target,
                     iconCls: 'icon-empty'
                 });
             } else {
                 dg.datagrid('showColumn', item.name);
                 dg.datagrid('setColumnSize', item.name);
                 cmenu.menu('setIcon', {
                     target: item.target,
                     iconCls: 'icon-ok'
                 });
             }
         }
     });
     let fields = dg.datagrid('getColumnFields');
     for (let i = 0; i < fields.length; i++) {
         let field = fields[i];
         let col = dg.datagrid('getColumnOption', field);
         if (col.title) {
             cmenu.menu('appendItem', {
                 text: col.title,
                 name: field,
                 iconCls: col.hidden ? 'icon-empty' : 'icon-ok'
             });
         }
     }

     return cmenu;
 }

 function addTab(title, href) {
     let mainTabs = $('#mainTabs');
     if (mainTabs.tabs('exists', title)) {
         mainTabs.tabs('select', title);
     } else {
         let content = ` <iframe scrolling="yes" src="${href}" frameborder="0" height="99%" width="100%"  frameborder="0" ></iframe> `;
         mainTabs.tabs('add', {
             title: title,
             content: content,
             plugin: 'clients',
             closable: true
         });
     }
 }

 //页面加载完成执行
 $(function() {
     $.get('/user/isOnline', function(result) {
         if (result.success === false) {
             location.href = '/login.html';
         } else {
             user = result.data;
             $('#lblUserName').html(user.username);
         }
     });
     let mainTabs = $('#mainTabs');
     let mainTabMenus = $('#mainTabMenus');

     window.onhashchange = function() {
         let v = location.hash.substring(1, location.hash.length);
         let title = (decodeURI(v));
         mainTabs.tabs('select', title);
     }

     renderInit();

     $('#nav-accordion a').click(function(event) {
         $('#nav-accordion a').removeClass('active');
         $(event.target).addClass('active');
         let title = $(event.target).attr('title');
         let href = $(event.target).attr('page');
         if (mainTabs.tabs('exists', title)) {
             mainTabs.tabs('select', title);
         } else {
             let content = ` <iframe scrolling="yes" src="${href}" frameborder="0" height="99%" width="100%"  frameborder="0" ></iframe> `;
             mainTabs.tabs('add', {
                 title: title,
                 content: content,
                 plugin: 'clients',
                 closable: true
             });
         }
     });

     //$('body').layout({ applyDemoStyles: true });

     mainTabs.tabs({
         tools: [{
             iconCls: "icon-reload",
             text: '<a href="javascript:void(0);"  title="点击刷新当前标签"></a>',
             handler: function() {
                 let tab = mainTabs.tabs('getSelected');
                 let ii = tab.find('iframe')[0];
                 $(ii).attr('src', $(ii).attr('src'));
             }
         }],
         onContextMenu: function(e, title, index) {
             e.preventDefault();
             mainTabMenus.menu('show', {
                 left: e.pageX,
                 top: e.pageY
             }).data("curTabTitle", title);
         },
         onSelect: function(title, index) {
             window.location.hash = encodeURI(title);
         },
         onLoad: function(panel) {
             let title = panel.panel('options').title;
             window.location.hash = encodeURI(title);
         }
     });

     //tabs右键菜单响应
     mainTabMenus.menu({
         onClick: function(item) {
             let curTabTitle = $(this).data("curTabTitle");

             switch (item.name) {
                 case 'refresh':
                     let tab = mainTabs.tabs('getSelected');
                     let ii = tab.find('iframe')[0];
                     $(ii).attr('src', $(ii).attr('src'));
                     break;
                 case 'close':
                     mainTabs.tabs('close', curTabTitle);
                     break;
                 case 'other':
                     $('.tabs-inner span').each(function(i, n) {
                         let t = $(n).text();
                         if (i > 0 && curTabTitle !== t) {
                             mainTabs.tabs('close', t);
                         }
                         if (t === curTabTitle) {
                             mainTabs.tabs('select', t);
                         }
                     });
                     break;
                 default:
                     $('.tabs-inner span').each(function(i, n) {
                         if (i > 0) {
                             let t = $(n).text();
                             mainTabs.tabs('close', t);
                         }
                     });
                     break;
             }
         }
     });
 });