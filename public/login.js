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
        let targetDom = $('#' + id);
        if (targetDom.val().trim() === '') {
            let d = dialog({
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
        let info = checkNotEmpty('password') + checkNotEmpty('vcode') + checkNotEmpty('username');
        if (info !== 3) {
            return;
        }
        let username = $('#username').val();
        let vcode = $('#vcode').val();
        let password = $('#password').val();
        $.post('/user/doLogin', { username, vcode, password }, function(result) {
            if (result.success) {
                location.href = '/';
            } else {

                if (result.data === 'vcode') {
                    $('#imgvcode').click();
                    $('#vcode').val('');
                }

                let d = dialog({
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