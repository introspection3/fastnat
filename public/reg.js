$(function() {
    'use strict';

    $('#username').focus();

    function alertMessage(content, title = '提示') {
        let d = dialog({
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
        let email = $('#email').val();
        let myReg = /^[a-zA-Z0-9_-]+@([a-zA-Z0-9]+\.)+(com|cn|net|org)$/;　　
        if (!myReg.test(email)) {　　　
            $('#email').focus();　　
            alertMessage('邮箱格式不对');
            return;
        } else {
            $.post('/user/sendEmailCode', { email }, function(ret) {
                alertMessage(ret.info);
                if (ret.success) {
                    $('#btnSendEmail').hide();
                    setInterval(() => {
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
        let targetDom = $('#' + id);
        if (targetDom.val().trim() === '') {
            targetDom.focus();
            return 0;
        }
        return 1;
    }
    $('#btnReg').click(function() {
        let info = checkNotEmpty('vcode') + checkNotEmpty('emailCode') + checkNotEmpty('email') + checkNotEmpty('password') + checkNotEmpty('username');
        if (info !== 5) {
            let d = dialog({
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
        let username = $('#username').val();
        let password = $('#password').val();
        let email = $('#email').val();
        let emailCode = $('#emailCode').val();

        let myReg = /^[a-zA-Z0-9_-]+@([a-zA-Z0-9]+\.)+(com|cn|net|org)$/;　　

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

        let vcode = $('#vcode').val();
        $.post('/user/register', { username, vcode, password, emailCode, email }, function(result) {
            if (result.success) {
                location.href = '/';
            } else {
                $('#' + result.data).focus();
                if (result.data === 'vcode') {
                    $('#imgvcode').click();
                    $('#vcode').val('')
                }
                let msg = result.info;
                if (typeof msg === typeof {}) {
                    msg = JSON.stringify(msg);
                }
                alertMessage(msg);
            }
        });
    });
});