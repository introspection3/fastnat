$(function() {
    'use strict';

    $('#username').focus();

    function alertMessage(content) {
        var title = '提示';
        var d = dialog({
            title: title,
            width: 200,
            content: content,
            quickClose: true,
            ok: function() {

            }
        });
        d.show();
    }
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
    $('#btnSendEmail').click(function() {
        var email = $('#email').val();
        var myReg = /^[a-zA-Z0-9_-]+@([a-zA-Z0-9]+\.)+(com|cn|net|org)$/;　　
        if (!myReg.test(email)) {　　　
            $('#email').focus();　　
            alertMessage('邮箱格式不对');
            return;
        } else {
            $.post('/user/sendEmailCode', { email: email }, function(ret) {
                alertMessage(ret.info);
                if (ret.success) {
                    $('#btnSendEmail').hide();
                    setInterval(function() {
                        $('#btnSendEmail').show();
                    }, 10000);
                }
            });
        }
    });
    $('#imgvcode').click(function() {
        $('#imgvcode').attr('src', '/user/vcode?_=' + Math.random());
    });

    $('#vcode').keyup(function(event) {
        if (event.keyCode == 13) {
            $('#btnReg').click();
        }
    });

    function checkNotEmpty(id) {
        var targetDom = $('#' + id);
        if (targetDom.val().trim() === '') {
            targetDom.focus();
            return 0;
        }
        return 1;
    }
    $('#btnReg').click(function() {
        var info = checkNotEmpty('vcode') + checkNotEmpty('emailCode') + checkNotEmpty('email') + checkNotEmpty('password') + checkNotEmpty('username');
        if (info !== 5) {
            var d = dialog({
                title: '提示',
                width: 200,
                content: '此项不能为空',
                quickClose: true,
                ok: function() {

                }
            });
            d.show();
            return;
        }
        var username = $('#username').val();
        var password = $('#password').val();
        var email = $('#email').val();
        var emailCode = $('#emailCode').val();

        var myReg = /^[a-zA-Z0-9_-]+@([a-zA-Z0-9]+\.)+(com|cn|net|org)$/;　　

        if (!myReg.test(email)) {　　　
            $('#email').focus();　　
            alertMessage('邮箱格式不对');
            return;
        }

        if (emailCode.length < 4) {
            alertMessage('邮箱验证码格式有误');
            $('#emailCode').focus();
            return;
        }
        if (password.length < 6) {
            alertMessage('密码长度有误');
            $('#password').focus();
            return;
        }

        var vcode = $('#vcode').val();
        $.post('/user/register', { username: username, vcode: vcode, password: password, emailCode: emailCode, email: email }, function(result) {
            if (result.success) {
                location.href = '/';
            } else {
                $('#' + result.data).focus();
                if (result.data === 'vcode') {
                    $('#imgvcode').click();
                    $('#vcode').val('')
                }
                var msg = result.info;
                if (typeof msg === typeof {}) {
                    msg = JSON.stringify(msg);
                }
                alertMessage(msg);
            }
        });
    });
});