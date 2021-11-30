$(function() {
    'use strict';

    $('#username').focus();

    $.get('/user/isOnline', function(result) {
        if (result.success) {
            location.href = '/';
        }
    });

    $('.form-control').on('input', function() {
        var $field = $(this).closest('.form-group');
        if (this.value) {
            $field.addClass('field--not-empty');
        } else {
            $field.removeClass('field--not-empty');
        }
    });

    $('#imgvcode').click(function() {
        $('#imgvcode').attr('src', '/user/vcode?_=' + Math.random());
    });

    $('#vcode').keyup(function(event) {
        if (event.keyCode == 13) {
            $('#btnLogin').click();
        }
    });

    function checkNotEmpty(id) {
        var targetDom = $('#' + id);
        if (targetDom.val().trim() === '') {
            var d = dialog({
                quickClose: true,
                content: '此项不能为空',
                onclose: function() {
                    targetDom.focus();
                },
                follow: targetDom[0]
            });
            d.show();
            return 0;
        }
        return 1;
    }
    $('#btnLogin').click(function() {
        var info = checkNotEmpty('password') + checkNotEmpty('vcode') + checkNotEmpty('username');
        if (info !== 3) {
            return;
        }
        var username = $('#username').val();
        var vcode = $('#vcode').val();
        var password = $('#password').val();
        $.post('/user/doLogin', { username: username, vcode: vcode, password: password }, function(result) {
            if (result.success) {
                setTimeout(function() {
                    location.reload();
                }, 1000);
            } else {

                if (result.data === 'vcode') {
                    $('#imgvcode').click();
                    $('#vcode').val('');
                }

                var d = dialog({
                    title: '提示',
                    width: 200,
                    content: result.info,
                    quickClose: true,
                    ok: function() {
                        $('#' + result.data).focus();
                    }
                });
                d.show();
            }
        });
    });
});