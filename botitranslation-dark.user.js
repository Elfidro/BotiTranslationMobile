// ==UserScript==
// @name         BotiTranslation Dark Mode
// @namespace    https://github.com/Elfidro/BotiTranslationMobile
// @version      1.0.0
// @description  Forces the site's built-in dark skin on botitranslation.com and patches the parts it leaves light. Chapter pages are left alone because the reader has its own themes.
// @author       Elfidro
// @homepageURL  https://github.com/Elfidro/BotiTranslationMobile
// @supportURL   https://github.com/Elfidro/BotiTranslationMobile/issues
// @updateURL    https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation-dark.user.js
// @downloadURL  https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation-dark.user.js
// @match        https://www.botitranslation.com/*
// @match        https://botitranslation.com/*
// @exclude      https://www.botitranslation.com/chapter/*
// @exclude      https://botitranslation.com/chapter/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // The site ships two skins in its own stylesheet: .skin-default (light) and
  // .skin-dark. It never switches to .skin-dark by itself, and the dark skin
  // is unfinished (grey inputs, white rank lists / dialogs / tables). This
  // script swaps the body class and fills in the gaps.

  var BG     = '#1d1d1d'; // page background (matches the site's .skin-dark)
  var PANEL  = '#262626'; // cards, announcements, rank lists, dialogs
  var FIELD  = '#2b2b2b'; // inputs, selects, tags, pills
  var BORDER = '#3d3d3d';
  var TEXT   = '#e0e0e0';
  var TEXT_2 = '#b8b8b8';
  var TEXT_3 = '#8c8c8c';
  var LINK   = '#8ab4f8'; // the site's #3b5998 is unreadable on dark

  var CSS = [
    ':root{color-scheme:dark}',
    'html,body{background-color:' + BG + ' !important}',
    // hide the white flash before the body class is swapped
    'body.skin-default{background-color:' + BG + ' !important}',

    // scrollbars
    '::-webkit-scrollbar{width:10px;height:10px}',
    '::-webkit-scrollbar-track{background:' + BG + ' !important}',
    '::-webkit-scrollbar-thumb{background:#4a4a4a !important;border-radius:5px}',

    // text tiers the dark skin forgets (used on book pages, dialogs, rank lists)
    'body.skin-dark .text-dark{color:' + TEXT + ' !important}',
    'body.skin-dark .text-normal{color:' + TEXT_2 + ' !important}',
    'body.skin-dark .text-light{color:' + TEXT_2 + ' !important}',
    'body.skin-dark .text-lighter{color:' + TEXT_3 + ' !important}',
    'body.skin-dark .title-color{color:' + TEXT + ' !important}',
    'body.skin-dark .subtitle-color{color:' + TEXT_2 + ' !important}',
    'body.skin-dark .tag-color{color:' + TEXT_3 + ' !important}',

    // links / accent text
    'body.skin-dark a,body.skin-dark .main-text{color:' + LINK + ' !important}',
    'body.skin-dark a:hover{color:#c2d6ff !important}',
    'body.skin-dark .footer .menu .menu-item:hover{color:' + LINK + ' !important}',
    // but keep buttons white-on-blue
    'body.skin-dark .btn-primary,body.skin-dark .btn-primary *,body.skin-dark .btn-primary i,' +
      'body.skin-dark .main-tags-color .tag.active,body.skin-dark .pay-check-btn.checked .pay-text{color:#fff !important}',
    'body.skin-dark .btn-outline{color:' + LINK + ' !important;border-color:' + LINK + ' !important}',
    'body.skin-dark .btn-second{color:' + LINK + ' !important}',
    'body.skin-dark .btn-danger{background-color:#3a2323 !important}',
    'body.skin-dark .btn-danger:hover{background-color:#4a2a2a !important}',

    // panels the dark skin leaves light
    'body.skin-dark .announcements,' +
      'body.skin-dark .block-style-7 .rank-panels .rank-list,' +
      'body.skin-dark .block-style-5,' +
      'body.skin-dark .main-slides,' +
      'body.skin-dark .dialog-panel,' +
      'body.skin-dark .report-container .book-info,' +
      'body.skin-dark .chapter-author-note,' +
      'body.skin-dark .bg-main,body.skin-dark .bg-secondary' +
      '{background:' + PANEL + ' !important;background-color:' + PANEL + ' !important}',
    'body.skin-dark .dialog-panel{border-color:' + BORDER + ' !important;box-shadow:0 0 12px rgba(0,0,0,.6) !important}',
    'body.skin-dark .report-container .book-info .left-img{background:' + FIELD + ' !important}',
    'body.skin-dark .main-slides .swiper-pagination-bullet{background:#777 !important}',
    'body.skin-dark .main-slides .swiper-pagination-bullet-active{background:' + LINK + ' !important}',
    'body.skin-dark .block-style-5 .swiper-slide img,' +
      'body.skin-dark .block-style-7 .rank-panels .rank-list .book .book-cover,' +
      'body.skin-dark .block-style-12 .book-container .book .book-cover,' +
      'body.skin-dark .block-style-14 .book-container .book .book-cover,' +
      'body.skin-dark img.book-cover{background:' + FIELD + ' !important}',
    'body.skin-dark .footer{background-color:#151515 !important}',
    'body.skin-dark nav.with-shadow,body.skin-dark .nav.with-shadow{box-shadow:0 2px 8px rgba(0,0,0,.6) !important}',
    'body.skin-dark .loading-overlay{background-color:rgba(29,29,29,.6) !important}',
    'body.skin-dark .up-shadow{box-shadow:0 -2px 5px #000 !important}',
    'body.skin-dark .down-shadow{box-shadow:0 2px 5px #000 !important}',

    // the dark skin paints these plain "gray" (#808080)
    'body.skin-dark .block-bg-color,body.skin-dark .main-tags-color .tag{background-color:' + FIELD + ' !important}',
    'body.skin-dark .line-color{background-color:' + BORDER + ' !important}',
    'body.skin-dark .border-color{border-color:' + BORDER + ' !important}',
    'body.skin-dark .bottom-border{border-bottom-color:' + BORDER + ' !important}',
    'body.skin-dark .line{background:' + BORDER + ' !important}',

    // form controls
    'body.skin-dark input,body.skin-dark select,body.skin-dark textarea,' +
      'body.skin-dark .page-select,body.skin-dark .report-type-select,body.skin-dark .report-textarea' +
      '{background-color:' + FIELD + ' !important;color:' + TEXT + ' !important;border-color:' + BORDER + ' !important}',
    'body.skin-dark input::placeholder,body.skin-dark textarea::placeholder{color:' + TEXT_3 + ' !important}',
    'body.skin-dark .search-bar{border-color:' + BORDER + ' !important}',
    'body.skin-dark input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px ' + FIELD + ' inset !important;-webkit-text-fill-color:' + TEXT + ' !important}',

    // book page: table of contents and the white "Read" button
    'body.skin-dark .toc-list tr:nth-child(2n+1){background:' + PANEL + ' !important}',
    'body.skin-dark .toc-list tr:nth-child(2n){background:' + BG + ' !important}',
    'body.skin-dark .cover-container .info-section .btns .btn-solid{background:' + FIELD + ' !important;color:' + TEXT + ' !important;box-shadow:0 2px 8px rgba(0,0,0,.5) !important}',
    'body.skin-dark .cover-container .info-section .btns .btn-solid:hover{background:#383838 !important}',

    // coin / payment pickers in dialogs
    'body.skin-dark .money-check-btn,body.skin-dark .pay-check-btn{background:' + FIELD + ' !important;border-color:' + BORDER + ' !important;color:' + TEXT + ' !important}',
    'body.skin-dark .money-check-btn *,body.skin-dark .pay-check-btn .pay-text{color:' + TEXT + ' !important;border-color:' + BORDER + ' !important}',
    'body.skin-dark .money-text,body.skin-dark .question{color:' + TEXT_2 + ' !important}',
    'body.skin-dark .report-container .book-info .right-info .chapter-name{color:' + TEXT_3 + ' !important}',

    // toast messages
    'body.skin-dark .msg-success,body.skin-dark .msg-warn,body.skin-dark .msg-error,body.skin-dark .msg-info{filter:brightness(.85)}',

    // icons
    'body.skin-dark .icon-style.menu{fill:' + TEXT + ' !important}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('boti-dark-style')) return;
    var style = document.createElement('style');
    style.id = 'boti-dark-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function applySkin() {
    var body = document.body;
    if (!body) return;
    if (body.classList.contains('skin-default')) body.classList.remove('skin-default');
    if (!body.classList.contains('skin-dark')) body.classList.add('skin-dark');
  }

  injectStyle();
  applySkin();

  // <body> may not exist yet at document-start, and the site may rewrite the
  // class list later, so keep watching.
  var observer = new MutationObserver(function () {
    injectStyle();
    applySkin();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: false,
    attributes: true,
    attributeFilter: ['class']
  });

  document.addEventListener('DOMContentLoaded', function () {
    applySkin();
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
