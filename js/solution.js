'use strict';

class imageReviewApp {
  constructor(container) {
    this.app = container;
    this.menu = this.app.querySelector('.menu');
    this.menuItems = this.app.querySelectorAll('.menu__item');
    this.drag = this.menu.querySelector('.drag');
    this.burgerBtn = this.menu.querySelector('.burger');

    this.modes = this.menu.querySelectorAll('.mode');
    this.tools = this.menu.querySelectorAll('.tool');

    this.newBtn = this.menu.querySelector('.new');

    this.commentsBtn = this.menu.querySelector('.comments');
    this.commentsTools = this.menu.querySelector('.comments-tools');
    this.commentsOnBtn = this.commentsTools.querySelector('.menu__toggle[value="on"]');
    this.commentsOffBtn = this.commentsTools.querySelector('.menu__toggle[value="off"]');

    this.drawBtn = this.menu.querySelector('.draw');
    this.drawTools = this.menu.querySelector('.draw-tools');

    this.shareBtn = this.menu.querySelector('.share');
    this.shareTools = this.menu.querySelector('.share-tools');

    this.urlImg = this.app.querySelector('.menu__url');
    this.currImg = this.app.querySelector('.current-image');
    this.error = this.app.querySelector('.error');
    this.errorMsg = this.app.querySelector('.error__message');
    this.loader = this.app.querySelector('.image-loader');

    this.commentsForm = this.app.querySelector('.comments__form');
    this.boundsForm = this.commentsForm.getBoundingClientRect();
    this.boundsMarker = this.commentsForm.querySelector('.comments__marker').getBoundingClientRect();

    this.errors = [
      'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.',
      'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню.'
    ];
    this.url = '//neto-api.herokuapp.com';

    this.picture = document.createElement('div');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.drawing = false;
    this.curves = [];
    this.needsRedraw = false;

    this.initApp();
    this.registerEvents();
  }

  //================================================================
  // Обработчики событий:
  //================================================================

  // Установка обработчиков событий:
  registerEvents() {
    window.addEventListener('resize', () => this.findMenuPosition());

    this.drag.addEventListener('mousedown', event => this.startDragMenu(event));
    document.addEventListener('mousemove', event => this.dragMenu(event));
    document.addEventListener('mouseup', event => this.dropMenu(event));

    this.menu.addEventListener('click', event => {
      if (this.menu.dataset.state !== 'initial' && event.target !== this.drag) {
        if (event.target === this.newBtn || event.target.closest('.new') === this.newBtn) {
          this.clearPage();
        } else {
          this.hideCommentsForm(true);
        }
        this.selectMenuState(event);
      }
    });

    this.newBtn.addEventListener('click', () => {
      if (this.menu.dataset.state === 'initial') {
        this.selectImage();
      }
    });

    this.currImg.addEventListener('dragstart', event => event.preventDefault());
    this.app.addEventListener('dragover', event => event.preventDefault());
    this.app.addEventListener('drop', event => this.dropImage(event));

    this.shareTools.addEventListener('click', event => this.copyLink(event));

    this.commentsTools.addEventListener('change', () => this.toggleCommentsMarkerDisplay());
    this.picture.addEventListener('click', event => this.addNewCommentsForm(event));

    this.canvas.addEventListener('mousedown', event => {
      if (this.drawBtn.dataset.state === 'selected') {
        this.startDrawing(event);
      }
    });
    this.canvas.addEventListener('mousemove', (event) => {
      if (this.drawBtn.dataset.state === 'selected') {
        this.draw(event);
      }
    });
    this.canvas.addEventListener('mouseleave', () => {
      if (this.drawBtn.dataset.state === 'selected') {
        this.drawing = false;
      }
    });
    this.canvas.addEventListener('mouseup', () => {
      if (this.drawBtn.dataset.state === 'selected') {
        this.stopDrawing();
      }
    });

    this.drawTools.addEventListener('change', () => this.toggleBrushColor());
  }

  //================================================================
  // Запуск приложения и общие функции
  //================================================================

  // Инициализация приложения:
  initApp() {
    this.app.removeChild(this.commentsForm);
    this.picture.appendChild(this.currImg);
    this.picture.insertBefore(this.canvas, this.currImg.nextElementSibling);
    this.app.insertBefore(this.picture, this.menu.nextElementSibling);

    if (!sessionStorage.imageInfo) {
      this.deleteImg();
      this.changeCommentsMarkerDisplay();
      this.saveToSessionStorage('menuHeight', this.menu.offsetHeight);

      if (location.search && (this.getFromSessionStorage('menuMode') === undefined || this.getFromSessionStorage('menuMode').state !== 'initial')) {
        this.showLoader();
        const idImg = location.search.replace('?id=', '');
        this.serverRequest(`/pic/${idImg}`);
      } else {
        this.selectMenuMode('initial');
      }
    } else {
      this.showLoader();
      this.showCurrImg();
    }
  }

  // Определение положения меню:
  findMenuPosition() {
    let x, y;
    if (!sessionStorage.menuPosition) {
      x = this.menu.getBoundingClientRect().left;
      y = this.menu.getBoundingClientRect().top;
    } else {
      x = this.getFromSessionStorage('menuPosition').x;
      y = this.getFromSessionStorage('menuPosition').y;
      this.setMenuPosition(x, y);
    }

    if (this.menu.offsetHeight > this.getFromSessionStorage('menuHeight')) {
      while (this.menu.offsetHeight > this.getFromSessionStorage('menuHeight')) {
        x = --x;
        this.menu.style.left = `${x}px`;
      }
      this.saveToSessionStorage('menuPosition', {x: x, y: y});
    }
  }

  // Задание положения меню на странице:
  setMenuPosition(x, y) {
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
  }

  // Отоборажение картинки на странице:
  showCurrImg(state, mode) {
    const imgData = this.getFromSessionStorage('imageInfo');
    this.startWebSocket(imgData.id);

    this.currImg.src = imgData.url;
    this.urlImg.value = location.search ? location.href.replace(location.search, `?id=${imgData.id}`) : `${location.href}?id=${imgData.id}`;

    if (state) {
      this.selectMenuMode(state, mode);
    } else {
      const menuMode = this.getFromSessionStorage('menuMode');
      this.selectMenuMode(menuMode.state, menuMode.mode);
    }

    this.currImg.addEventListener('load', () => {
      this.picture.style.width = `${this.currImg.width}px`;
      this.picture.style.height = `${this.currImg.height}px`;
      this.picture.classList.add('current-image');
      this.canvas.width = this.currImg.width;
      this.canvas.height = this.currImg.height;
      this.canvas.classList.add('current-image');

      this.hideElement(this.loader);
      this.showElement(this.menu);
      this.findMenuPosition();
      this.checkCommentsMarkerDisplay();
      this.checkComments();
      this.checkBrushColor();

      if (mode === 'share') {
        this.sendMask()
        .then(response => this.startWebSocket(imgData.id))
      }
    });
  }

  // Удаление изображения и его ссылки со страницы:
  deleteImg() {
    this.currImg.src = '';
    this.urlImg.value = '';
  }

  // Очистка страницы:
  clearPage() {
    sessionStorage.clear();
    this.connectionWSS.close();
    this.deleteImg();
    this.changeCommentsMarkerDisplay();
    this.saveToSessionStorage('menuHeight', this.menu.offsetHeight);
    this.canvas.style.background = '';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.picture.classList.remove('current-image');
    this.canvas.classList.remove('current-image');
    this.picture.querySelectorAll('.comments__form').forEach(form => {
      this.picture.removeChild(form);
    });
  }

  // Скрытие элемента на странице:
  hideElement(element) {
    element.style.display = 'none';
  }

  // Отображение элемента на странице:
  showElement(element) {
    element.style.display = 'inline-block';
  }

  // Показ прелоадера в момент загрузки:
  showLoader() {
    this.hideElement(this.menu);
    this.сommentsMarkerDisplay(false);
    this.showElement(this.loader);
  }

  //================================================================
  // Переключение режимов приложения
  //================================================================

  // Переключение состояния приложения:
  selectMenuState(event) {
    if (event.target === this.newBtn || event.target.closest('.menu__item') === this.newBtn) {
      this.selectMenuMode('initial');
    }
    if (event.target === this.burgerBtn || event.target.closest('.menu__item') === this.burgerBtn) {
      this.selectMenuMode('default');
    }
    if (event.target === this.commentsBtn || event.target.closest('.menu__item') === this.commentsBtn) {
      this.selectMenuMode('selected', 'comments');
    }
    if (event.target === this.drawBtn || event.target.closest('.menu__item') === this.drawBtn) {
      this.selectMenuMode('selected', 'draw');
    }
    if (event.target === this.shareBtn || event.target.closest('.menu__item') === this.shareBtn) {
      this.selectMenuMode('selected', 'share');
    }
  }

  // Переключение режима приложения:
  selectMenuMode(state, mode) {
    switch(state) {
      case 'initial':
        this.menu.dataset.state = 'initial';
        this.hideElement(this.burgerBtn);
        break;
      case 'default':
        this.menu.dataset.state = 'default';
        this.hideElement(this.burgerBtn);
        this.menu.querySelectorAll('[data-state="selected"]').forEach(item => item.dataset.state = '');
        break;
      case 'selected':
        this.menu.dataset.state = 'selected';
        this.showElement(this.burgerBtn);
        Array.from(this.modes).find(item => item.classList.contains(mode)).dataset.state = 'selected';
        break;
    }
    this.saveToSessionStorage('menuMode', {state: state, mode: mode});
    this.findMenuPosition();
  }

  //================================================================
  // Запросы на сервер и работа с локальным хранилищем
  //================================================================

  // Запросы на сервер:
  serverRequest(endUrl, data, type) {
    const url = `https:${this.url}${endUrl}`;
    if (type === 'multipart/form-data') {
      return fetch(url, {
        method: 'POST',
        body: data
      })
      .then(result => result.json())
      .then(data => {
        this.saveToSessionStorage('imageInfo', data);
        this.showCurrImg('selected', 'share');
      })
      .catch(error => this.showErrorMsg(error))
    } else if (type === 'application/x-www-form-urlencoded') {
      return fetch(url, {
        method: 'POST',
        body: data,
        headers: {
          'Content-Type': type
        }
      })
      .then(result => result.json())
      .then(data => {
        this.saveToSessionStorage('imageInfo', data);
      })
      .catch(error => {
        this.showErrorMsg(error);
      })
    } else {
      return fetch(url)
      .then(result => result.json())
      .then(data => {
        this.saveToSessionStorage('imageInfo', data);
        this.showCurrImg('selected', 'comments');
      })
      .catch(error => this.showErrorMsg(error, false))
    }
  }

  // Сохранение данныx в локальное хранилище:
  saveToSessionStorage(key, data) {
    sessionStorage[key] = JSON.stringify(data);
  }

  // Получение данных из локального хранилища:
  getFromSessionStorage(key) {
    try {
      if (sessionStorage[key]) {
        return JSON.parse(sessionStorage[key]);
      }
    } catch (error) {
      console.error(`${error}`);
    }
  }

  // Добавление данных в локальное хранилище:
  addToSessionStorage(key, data) {
    const imgData = this.getFromSessionStorage(key);
    if (!imgData.comments) {
      imgData.comments = {};
    }
    if (!imgData.comments[data.id]) {
      imgData.comments[data.id] = {
        left: data.left,
        message: data.message,
        timestamp: data.timestamp,
        top: data.top
      }
      this.saveToSessionStorage(key, imgData);
    }
  }

  //================================================================
  // Перетаскивание меню
  //================================================================

  // Запуск перетаскивания меню:
  startDragMenu(event) {
    this.moveMenu = true;
    this.shiftX = event.pageX - this.menu.getBoundingClientRect().left - window.pageXOffset;
    this.shiftY = event.pageY - this.menu.getBoundingClientRect().top - window.pageYOffset;
    this.minX = this.app.offsetLeft;
    this.minY = this.app.offsetTop;
    this.maxX = this.app.offsetLeft + this.app.offsetWidth - this.menu.getBoundingClientRect().width;
    this.maxY = this.app.offsetTop + this.app.offsetHeight - this.menu.getBoundingClientRect().height;
  }

  // Перетаскивание меню:
  dragMenu(event) {
    if (this.moveMenu) {
      this.findMenuCoord(event);
    }
  }

  // Окончание перетаскивания меню:
  dropMenu(event) {
    if (this.moveMenu) {
      this.moveMenu = false;
      this.saveToSessionStorage('menuPosition', this.findMenuCoord(event));
    }
  }

  // Нахождение новых координат меню:
  findMenuCoord(event) {
    let x, y;
    x = event.pageX - this.shiftX;
    y = event.pageY - this.shiftY;
    x = Math.min(x, this.maxX);
    y = Math.min(y, this.maxY);
    x = Math.max(x, this.minX);
    y = Math.max(y, this.minY);
    this.setMenuPosition(x, y);
    return {x: x, y: y};
  }

  //================================================================
  // Загрузка изображения
  //================================================================

  // Выбор изображения при клике на поле "Загрузить новое":
  selectImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png';
    input.click();
    input.addEventListener('change', event => {
      const file = event.currentTarget.files[0];
      this.sendImg(file);
    });
  }

  // Выбор изображения при перетаскивании его на холст:
  dropImage(event) {
    event.preventDefault();

    if (sessionStorage.imageInfo) {
      this.showErrorMsg(this.errors[1]);
      return;
    }
    const file = event.dataTransfer.files[0];
    const imageTypeRegExp = /^image\/[jpeg|png]/;
    if (imageTypeRegExp.test(file.type)) {
      this.sendImg(file);
    } else {
      this.showErrorMsg(this.errors[0]);
    }
  }

  // Отправка изображения на сервер:
  sendImg(file) {
    this.showLoader();
    const name = file.name.replace(/\.\w*$/, "");
    const data = new FormData();
    data.append('title', `${name}`);
    data.append('image', file);
    this.serverRequest('/pic', data, 'multipart/form-data');
  }

  // Отображение ошибки на странице:
  showErrorMsg(errorMsg, closeMsg = true) {
    this.hideElement(this.menu);
    this.hideElement(this.loader);
    this.errorMsg.textContent = errorMsg;
    this.showElement(this.error);
    if (closeMsg) {
      setTimeout(() => {
        this.hideElement(this.error);
        this.showElement(this.menu);
      }, 3000);
    }
  }

  //================================================================
  // Копирование ссылки
  //================================================================

  // Копирование ссылки в режиме "Поделиться":
  copyLink(event) {
    if (event.target.classList.contains('menu_copy')) {
      const link = document.createElement('textarea');
      link.textContent = this.menu.querySelector('.menu__url').value;
      document.body.appendChild(link);
      link.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error(error);
        this.showErrorMsg('Не удалось скопировать ссылку');
      }
      document.body.removeChild(link);
    }
  }

  //================================================================
  // Работа с комментариями
  //================================================================

  // Проверка необходимости отображения/ скрытия маркеров коммантариев на странице:
  checkCommentsMarkerDisplay() {
    let display =  this.getFromSessionStorage('markerDisplay');
    this.changeCommentsMarkerDisplay(display);
    return display;
  }

  // Переключение отображения/ скрытия маркеров коммантариев на странице:
  toggleCommentsMarkerDisplay() {
    const display = this.commentsTools.querySelector('.menu__toggle:checked').value === 'on';
    this.changeCommentsMarkerDisplay(display);
  }

  // Изменение положения переключателя и отображения/ скрытия комментариев:
  changeCommentsMarkerDisplay(display = true) {
    if (display) {
      this.commentsOnBtn.setAttribute('checked', '');
      this.commentsOffBtn.removeAttribute('checked');
    } else {
      this.commentsOffBtn.setAttribute('checked', '');
      this.commentsOnBtn.removeAttribute('checked');
    }
    this.saveToSessionStorage('markerDisplay', display);
    display ? this.сommentsMarkerDisplay() : this.сommentsMarkerDisplay(false);
  }

  // Отображение/ скрытие маркеров комментариев на странице:
  сommentsMarkerDisplay(display = true) {
    const commentsForms = this.app.querySelectorAll('.comments__form');
    if (commentsForms) {
      commentsForms.forEach(form => {
        display ? this.showElement(form) : this.hideElement(form);
      });
    }
  }

  // Скрытие / удаление формы комментариев на странице:
  hideCommentsForm(hideOnlyNew = false) {
    const openMarker = this.app.querySelector('.comments__marker-checkbox[disabled=""]');

    if (openMarker) {
      const openCommentsForm = openMarker.closest('.comments__form');
      const comment = openCommentsForm.querySelector('.comment');

      if (comment.firstElementChild.classList.contains('loader')) {
        this.picture.removeChild(openCommentsForm);
      } else if (!hideOnlyNew) {
        openMarker.checked = openMarker.disabled = false;
        openCommentsForm.style.zIndex = '';
      }
    }
  }

  // Создание шаблона формы добавления комментария:
  createCommentsFormTemplate(x, y) {
    return {
      tag: 'form',
      cls: 'comments__form',
      attrs: {style: `left: ${x}px; top: ${y}px;`, 'data-left': `${x}`, 'data-top': `${y}`},
      content: [
        {
          tag: 'span',
          cls: 'comments__marker',
        },
        {
          tag: 'input',
          cls: 'comments__marker-checkbox',
          attrs: {type: 'checkbox'}
        },
        {
          tag: 'div',
          cls: 'comments__body',
          content: [
            {
              tag: 'div',
              cls: 'comment',
              content: {
                tag: 'div',
                cls: 'loader',
                attrs: {style: 'display: none'},
                content: [
                  {tag: 'span'},
                  {tag: 'span'},
                  {tag: 'span'},
                  {tag: 'span'},
                  {tag: 'span'}
                ]
              }
            },
            {
              tag: 'textarea',
              cls: 'comments__input',
              attrs: {type: 'text', placeholder: 'Напишите ответ...'}
            },
            {
              tag: 'input',
              cls: 'comments__close',
              attrs: {type: 'button', value: 'Закрыть'}
            },
            {
              tag: 'input',
              cls: 'comments__submit',
              attrs: {type: 'submit', value: 'Отправить'}
            }
          ]
        }
      ]
    }
  }

  // Создание шаблона комментария:
  createCommentTemplate(id, comment) {
    return {
      tag: 'div',
      cls: 'comment',
      attrs: {'data-timestamp': `${comment.timestamp}`, 'data-id': `${id}`},
      content: [
        {
          tag: 'p',
          cls: 'comment__time',
          content: new Date(comment.timestamp).toLocaleString('ru-Ru').replace(',', '')
        },
        {
          tag: 'p',
          cls: 'comment__message',
          attrs: {style: 'white-space: pre'},
          content: comment.message
        }
      ]
    }
  }

  // Создание элемента разметки из шаблона:
  createElementFromTemplate(template) {
    if ((template === undefined) || (template === null) || (template === false)) {
      return document.createTextNode('');
    }
    if ((typeof template === 'string') || (typeof template === 'number') || (template === true)) {
      return document.createTextNode(template.toString());
    }
    if (Array.isArray(template)) {
      return template.reduce((fragment, element) => {
        fragment.appendChild(this.createElementFromTemplate(element));
        return fragment;
      }, document.createDocumentFragment());
    }

    const element = document.createElement(template.tag);

    if (template.cls) {
      element.classList.add(...[].concat(template.cls).filter(Boolean));
    }

    if (template.attrs) {
      Object.keys(template.attrs).forEach(key => {
        element.setAttribute(key, template.attrs[key])
      });
    }

    if (template.content) {
      element.appendChild(this.createElementFromTemplate(template.content));
    }

    return element;
  }

  // Добавление пользователем новой формы комментариев на страницу:
  addNewCommentsForm(event) {
    if (event.target.classList.contains('current-image') && this.commentsBtn.dataset.state === 'selected' && this.checkCommentsMarkerDisplay()) {
      this.hideCommentsForm();

      const shiftX = this.boundsMarker.left - this.boundsForm.left + this.boundsMarker.width / 2;
      const shiftY = this.boundsMarker.top - this.boundsForm.top + this.boundsMarker.height;

      const commentsForm = this.createNewCommentsForm(event.offsetX - shiftX, event.offsetY - shiftY);
      const markerCheckbox = commentsForm.querySelector('.comments__marker-checkbox');
      const textArea = commentsForm.querySelector('.comments__input');
      markerCheckbox.checked = markerCheckbox.disabled = true;
      textArea.focus();
    }
  }

  // Создание новой формы комментариев:
  createNewCommentsForm(x, y) {
    const commentsForm = this.createElementFromTemplate(this.createCommentsFormTemplate(x, y));
    this.picture.appendChild(commentsForm);

    commentsForm.addEventListener('change', event => this.openCommentsForm(event));
    commentsForm.addEventListener('click', event => this.closeCommentsForm(event));
    commentsForm.addEventListener('submit', event => this.sendComment(event));
    return commentsForm;
  }

  // Открытие формы комментариев при клике на маркер:
  openCommentsForm(event) {
    if (event.target.classList.contains('comments__marker-checkbox')) {
      this.hideCommentsForm();

      const markerCheckbox = event.target;
      const commentsForm = event.target.closest('.comments__form');
      const textArea = commentsForm.querySelector('.comments__input');

      markerCheckbox.checked = markerCheckbox.disabled = true;
      commentsForm.style.zIndex = '1';
      textArea.focus();
    }
  }

  // Закрытие формы комментариев при клике на кнопку "Закрыть":
  closeCommentsForm(event) {
    if (event.target.classList.contains('comments__close')) {
      this.hideCommentsForm();
    }
  }

  // Отправка комментария на сервер при клике на кнопку "Отправить":
  sendComment(event) {
    event.preventDefault();

    const commentsForm = event.target.closest('.comments__form');
    const loader = commentsForm.querySelector('.loader');
    const input = commentsForm.querySelector('.comments__input');
    const textArea = commentsForm.querySelector('.comments__input');
    const message = input.value;
    const left = commentsForm.dataset.left;
    const top = commentsForm.dataset.top;

    if (message) {
      this.showElement(loader);
      const id = this.getFromSessionStorage('imageInfo').id;
      const data = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
      this.serverRequest(`/pic/${id}/comments`, data, 'application/x-www-form-urlencoded');
    }
    input.value = '';
    textArea.focus();
  }

  // Добавление комментария на страницу:
  addComment(id, data) {
    let commentsForm = this.app.querySelector(`.comments__form[data-left="${data.left}"][data-top="${data.top}"]`);
    if (!commentsForm) {
      commentsForm = this.createNewCommentsForm(data.left, data.top);
    }
    const comments = Array.from(commentsForm.getElementsByClassName('comment'));
    const sameID = comments.find(comment => comment.dataset.id === id);

    if (!sameID) {
      const newComment = this.createElementFromTemplate(this.createCommentTemplate(id, data));
      const nextComment = comments.find(comment => Number(comment.dataset.timestamp) > data.timestamp);
      const commentsBody = commentsForm.querySelector('.comments__body');
      const loader = commentsForm.querySelector('.loader');
      commentsBody.insertBefore(newComment, nextComment ? nextComment : loader.parentElement);
      this.hideElement(loader);
      this.checkCommentsMarkerDisplay();
    }
  }

  // Проверка наличия комментариев к изображению:
  checkComments() {
    const comments = this.getFromSessionStorage('imageInfo').comments;
    if (comments) {
      const commentsKeys = Object.keys(comments);
      commentsKeys.forEach(key => this.addComment(key, comments[key]));
    }
  }

  //================================================================
  // Рисование
  //================================================================

  // Перерисовка изображения:
  redraw() {
    this.curves.forEach((curve) => {
      this.drawPoint(curve[0]);
      this.drawCurve(curve);
    })
  }

  // Начало рисования:
  startDrawing(event) {
    this.ctx.lineJoin = this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = this.ctx.fillStyle = getComputedStyle(this.app.querySelector('.menu__color:checked').nextElementSibling).backgroundColor;

    this.drawing = true;
    const point = [event.offsetX, event.offsetY];
    const curve = [];
    curve.push(point);
    this.curves.push(curve);
    this.redraw();
  }

  // Рисование:
  draw(event) {
    if (this.drawing) {
      const point = [event.offsetX, event.offsetY];
      this.curves[this.curves.length - 1].push(point);
      this.redraw();
    }
  }

  // Отрисовка точек:
  drawPoint(point) {
    this.ctx.beginPath();
    this.ctx.arc(...point,  this.ctx.lineWidth / 2, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  // Отрисовка кривых:
  drawCurve(points) {
    for(let i = 1; i < points.length - 1; i++) {
      this.smoothCurveBetween(points[i], points[i + 1]);
    }
  }

  // Сглаживание кривых:
  smoothCurveBetween(point1, point2) {
    const controlPoint = [(point1[0] + point2[0]) / 2, (point1[1] + point2[1]) / 2];
    this.ctx.beginPath();
    this.ctx.moveTo(point1[0], point1[1]);
    this.ctx.quadraticCurveTo(controlPoint[0], controlPoint[1], point2[0], point2[1]);
    this.ctx.stroke();
  }

  // Завершение рисования:
  stopDrawing() {
    this.drawing = false;
    this.sendMask()
    .then(response => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.curves = [];
    })
  }

  // Отправка данных холста на сервер:
  sendMask() {
    return new Promise((resolve) => {
      this.canvas.toBlob(blob => {
        this.connectionWSS.send(blob);
        this.connectionWSS.addEventListener('message', event => {
          const responseWSS = JSON.parse(event.data);
          if (responseWSS.event === 'mask') {
            resolve();
          }
        });
      });
    });
  }

  // Переключение цвета кисти:
  toggleBrushColor() {
    const brushColor = this.app.querySelector('.menu__color:checked').value;
    this.saveToSessionStorage('brushColor', brushColor);
  }

  // Проверка сохраненного ранее цвета кисти и его установка на странице:
  checkBrushColor() {
    if (this.getFromSessionStorage('brushColor')) {
      this.app.querySelectorAll('.menu__color').forEach(color => {
        if (color.classList.contains(this.getFromSessionStorage('brushColor'))) {
          color.setAttribute('checked', '');
        } else {
          color.removeAttribute('checked');
        }
      });
    }
  }

  //================================================================
  // Работа с Вебсокетом
  //================================================================

  // Подключение WebSocket:
  startWebSocket(id) {
    this.connectionWSS = new WebSocket(`wss:${this.url}/pic/${id}`);

    this.connectionWSS.addEventListener('open', event => {
      console.log('Вебсокет соединение установлено');
    });

    this.connectionWSS.addEventListener('close', event => {
      if (event.wasClean) {
        console.log('Вебсокет соединение закрыто чисто');
      } else {
        console.warn(`Обрыв соединения. Код:${event.code} причина:${event.reason}`);
      }
    });

    this.connectionWSS.addEventListener('error', event => {
      console.error(`Ошибка вебсокет соединения: ${error.message}`);
    });

    this.connectionWSS.addEventListener('message', event => {
      const responseWSS = JSON.parse(event.data);
      switch(responseWSS.event) {
        case 'pic':
          if (responseWSS.pic.mask) {
            console.log('Cобытие pic с маской');
            this.canvas.style.background = `url("${responseWSS.pic.mask}")`;
          }
          break;

        case 'comment':
          this.addToSessionStorage('imageInfo', responseWSS.comment);
          this.addComment(responseWSS.comment.id, responseWSS.comment);
          break;

        case 'mask':
          console.log('пришла маска!');
          this.canvas.style.background = `url("${responseWSS.url}")`;
          break;

        case 'error':
          console.error(`Ошибка: ${responseWSS.message}`);
          break;
      }
    });
  }
}

new imageReviewApp(document.querySelector('.wrap.app'));
