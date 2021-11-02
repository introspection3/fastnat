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
        let info = checkNotEmpty('vcode') + checkNotEmpty('telphone') + checkNotEmpty('email') + checkNotEmpty('password') + checkNotEmpty('username');
        if (info !== 5) {
            alert('此项不能为空');
            return;
        }
        let username = $('#username').val();
        let password = $('#password').val();
        let email = $('#email').val();
        let telphone = $('#telphone').val();

        let myReg = /^[a-zA-Z0-9_-]+@([a-zA-Z0-9]+\.)+(com|cn|net|org)$/;　　

        if (!myReg.test(email)) {　　　
            $('#email').focus();　　
            alert('邮箱格式不对');
            return;
        }

        if (telphone.length < 7) {
            alert('电话格式有误');
            $('#telphone').focus();
            return;
        }
        if (password.length < 6) {
            alert('密码长度有误');
            $('#password').focus();
            return;
        }

        let vcode = $('#vcode').val();
        $.post('/user/register', { username, vcode, password, telphone, email }, function(result) {
            if (result.success) {
                alert('注册成功');
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
                alert(msg);
            }
        });
    });
});