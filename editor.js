(function () {
  'use strict';

  let E = {
    dataUrl: null, canvas: null, ctx: null,
    w: 0, h: 0, dpr: 1,
    tool: 'pencil', color: '#ffffff', size: 3,
    history: [], historyIndex: -1,
    drawing: false, startX: 0, startY: 0, lastX: 0, lastY: 0,
    container: null, textInput: null, img: null
  };

  document.addEventListener('screenshot-open-editor', function (e) {
    if (E.container) closeEditor();
    E.dataUrl = e.detail.dataUrl;
    E.dpr = e.detail.devicePixelRatio || 1;
    var img = new Image();
    img.onload = function () {
      E.img = img;
      E.w = img.naturalWidth;
      E.h = img.naturalHeight;
      buildUI(img);
    };
    img.src = E.dataUrl;
  });

  function closeEditor() {
    if (E.container) {
      E.container.remove();
      E.container = null;
    }
    E.history = [];
    E.historyIndex = -1;
  }

  function buildUI(img) {
    E.container = document.createElement('div');
    E.container.id = 'screenshot-editor-container';

    var el = document.createElement('div');
    el.id = 'screenshot-editor';

    var header = document.createElement('div');
    header.id = 'screenshot-editor-header';
    header.innerHTML = '<span>Screenshot Editor</span>';
    var closeBtn = document.createElement('button');
    closeBtn.id = 'screenshot-editor-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = closeEditor;
    header.appendChild(closeBtn);
    el.appendChild(header);

    var body = document.createElement('div');
    body.id = 'screenshot-editor-body';

    var wrapper = document.createElement('div');
    wrapper.id = 'screenshot-editor-canvas-wrapper';

    E.canvas = document.createElement('canvas');
    E.canvas.id = 'screenshot-editor-canvas';
    E.canvas.width = E.w;
    E.canvas.height = E.h;
    var maxW = Math.min(E.w, window.innerWidth * 0.85);
    var maxH = Math.min(E.h, window.innerHeight * 0.7);
    E.canvas.style.maxWidth = maxW + 'px';
    E.canvas.style.maxHeight = maxH + 'px';
    E.canvas.style.width = Math.min(E.w, maxW) + 'px';
    E.canvas.style.height = Math.min(E.h, maxH) + 'px';

    wrapper.appendChild(E.canvas);
    body.appendChild(wrapper);

    body.appendChild(buildToolbar());
    el.appendChild(body);
    E.container.appendChild(el);
    document.body.appendChild(E.container);

    E.ctx = E.canvas.getContext('2d');
    E.ctx.drawImage(img, 0, 0);

    saveHistory();
    setupCanvasEvents();
    setupDrag(header, el);
  }

  function buildToolbar() {
    var tb = document.createElement('div');
    tb.id = 'screenshot-editor-toolbar';

    var g1 = document.createElement('div');
    g1.className = 'tool-group';
    var tools = [
      { id: 'cursor', icon: '\u2a31', title: 'Cursor' },
      { id: 'pencil', icon: '\u270f', title: 'Pencil' },
      { id: 'brush', icon: '\ud83d\udd8c', title: 'Brush' },
      { id: 'line', icon: '\u2571', title: 'Line' },
      { id: 'rect', icon: '\u25ad', title: 'Rectangle' },
      { id: 'arrow', icon: '\u2192', title: 'Arrow' },
      { id: 'text', icon: 'T', title: 'Text' },
      { id: 'circle', icon: '\u25cb', title: 'Circle' },
      { id: 'eraser', icon: '\u25cc', title: 'Eraser' },
      { id: 'blur', icon: '\u25ce', title: 'Blur' }
    ];
    tools.forEach(function (t) {
      var btn = document.createElement('button');
      btn.className = 'screenshot-tool-btn' + (t.id === 'pencil' ? ' active' : '');
      btn.title = t.title;
      btn.dataset.tool = t.id;
      btn.innerHTML = t.icon;
      btn.addEventListener('click', function () { selectTool(t.id); });
      g1.appendChild(btn);
    });
    tb.appendChild(g1);

    var g2 = document.createElement('div');
    g2.className = 'tool-group';
    var colors = ['#ffffff', '#ff4444', '#ff8800', '#ffdd00', '#00cc44', '#aa66ff'];
    colors.forEach(function (c) {
      var sw = document.createElement('div');
      sw.className = 'screenshot-color-swatch' + (c === '#ffffff' ? ' active' : '');
      sw.style.background = c;
      sw.dataset.color = c;
      sw.addEventListener('click', function () { selectColor(c, sw); });
      g2.appendChild(sw);
    });
    var cp = document.createElement('input');
    cp.type = 'color';
    cp.id = 'screenshot-color-picker';
    cp.value = '#ffffff';
    cp.addEventListener('input', function (e) {
      selectColor(e.target.value, cp);
    });
    g2.appendChild(cp);
    tb.appendChild(g2);

    var g3 = document.createElement('div');
    g3.className = 'tool-group';
    var sl = document.createElement('span');
    sl.className = 'screenshot-size-label';
    sl.id = 'screenshot-size-label';
    sl.textContent = '3px';
    var slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'screenshot-size-slider';
    slider.min = 1;
    slider.max = 50;
    slider.value = 3;
    slider.addEventListener('input', function (e) {
      E.size = parseInt(e.target.value, 10);
      sl.textContent = E.size + 'px';
    });
    g3.appendChild(sl);
    g3.appendChild(slider);
    tb.appendChild(g3);

    var g4 = document.createElement('div');
    g4.className = 'tool-group';
    var makeBtn = function (text, cls, fn) {
      var b = document.createElement('button');
      b.className = 'screenshot-action-btn ' + cls;
      b.textContent = text;
      b.addEventListener('click', fn);
      return b;
    };
    g4.appendChild(makeBtn('Undo', 'undo', undo));
    g4.appendChild(makeBtn('Clear', 'clear', clearAnnotations));
    g4.appendChild(makeBtn('Save', 'save', saveImage));
    g4.appendChild(makeBtn('Copy', 'copy', copyImage));
    tb.appendChild(g4);

    return tb;
  }

  function selectTool(id) {
    E.tool = id;
    var btns = document.querySelectorAll('.screenshot-tool-btn');
    btns.forEach(function (b) { b.classList.remove('active'); });
    var active = document.querySelector('.screenshot-tool-btn[data-tool="' + id + '"]');
    if (active) active.classList.add('active');
    E.canvas.style.cursor = id === 'cursor' ? 'default' : 'crosshair';
  }

  function selectColor(color, el) {
    E.color = color;
    document.querySelectorAll('.screenshot-color-swatch').forEach(function (s) {
      s.classList.remove('active');
    });
    if (el && el.classList) el.classList.add('active');
  }

  function setupCanvasEvents() {
    var c = E.canvas;
    c.addEventListener('mousedown', onMouseDown);
    c.addEventListener('mousemove', onMouseMove);
    c.addEventListener('mouseup', onMouseUp);
    c.addEventListener('mouseleave', onMouseUp);
  }

  function getCanvasCoords(e) {
    var rect = E.canvas.getBoundingClientRect();
    var scaleX = E.canvas.width / rect.width;
    var scaleY = E.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function onMouseDown(e) {
    if (E.tool === 'cursor') return;
    var p = getCanvasCoords(e);
    E.drawing = true;
    E.startX = p.x;
    E.startY = p.y;
    E.lastX = p.x;
    E.lastY = p.y;

    if (E.tool === 'text') {
      showTextInput(p);
      return;
    }

    if (E.tool === 'blur') {
      return;
    }

    if (E.tool === 'eraser') {
      E.ctx.globalCompositeOperation = 'destination-out';
    }

    E.ctx.beginPath();
    E.ctx.lineCap = 'round';
    E.ctx.lineJoin = 'round';
  }

  function onMouseMove(e) {
    if (!E.drawing) return;
    var p = getCanvasCoords(e);

    if (E.tool === 'pencil' || E.tool === 'eraser') {
      E.ctx.beginPath();
      E.ctx.moveTo(E.lastX, E.lastY);
      E.ctx.lineTo(p.x, p.y);
      E.ctx.strokeStyle = E.tool === 'eraser' ? 'rgba(0,0,0,1)' : E.color;
      E.ctx.lineWidth = E.size;
      E.ctx.stroke();
      E.lastX = p.x;
      E.lastY = p.y;
    } else if (E.tool === 'brush') {
      E.ctx.beginPath();
      E.ctx.moveTo(E.lastX, E.lastY);
      E.ctx.lineTo(p.x, p.y);
      E.ctx.strokeStyle = E.color;
      E.ctx.lineWidth = E.size;
      E.ctx.shadowColor = E.color;
      E.ctx.shadowBlur = E.size * 0.8;
      E.ctx.stroke();
      E.ctx.shadowBlur = 0;
      E.lastX = p.x;
      E.lastY = p.y;
    } else if (E.tool === 'blur') {
      renderBlurSelection(p);
    }
  }

  function onMouseUp(e) {
    if (!E.drawing) return;
    var p = getCanvasCoords(e);
    E.drawing = false;

    if (E.tool === 'eraser') {
      E.ctx.globalCompositeOperation = 'source-over';
      saveHistory();
      return;
    }

    if (E.tool === 'pencil' || E.tool === 'brush') {
      saveHistory();
      return;
    }

    if (E.tool === 'blur') {
      applyBlur(p);
      return;
    }

    var x = Math.min(E.startX, p.x);
    var y = Math.min(E.startY, p.y);
    var w = Math.abs(p.x - E.startX);
    var h = Math.abs(p.y - E.startY);

    if (w < 1 && h < 1) return;

    E.ctx.beginPath();

    if (E.tool === 'line' || E.tool === 'arrow') {
      E.ctx.moveTo(E.startX, E.startY);
      E.ctx.lineTo(p.x, p.y);
      E.ctx.strokeStyle = E.color;
      E.ctx.lineWidth = E.size;
      E.ctx.stroke();

      if (E.tool === 'arrow') {
        drawArrowhead(E.startX, E.startY, p.x, p.y);
      }
    } else if (E.tool === 'rect') {
      E.ctx.strokeStyle = E.color;
      E.ctx.lineWidth = E.size;
      E.ctx.strokeRect(x, y, w, h);
    } else if (E.tool === 'circle') {
      var cx = x + w / 2;
      var cy = y + h / 2;
      var rx = w / 2;
      var ry = h / 2;
      E.ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      E.ctx.strokeStyle = E.color;
      E.ctx.lineWidth = E.size;
      E.ctx.stroke();
    }

    saveHistory();
  }

  function renderBlurSelection(p) {
    var ctx = E.ctx;
    var x = Math.min(E.startX, p.x);
    var y = Math.min(E.startY, p.y);
    var w = Math.abs(p.x - E.startX);
    var h = Math.abs(p.y - E.startY);

    ctx.clearRect(0, 0, E.w, E.h);
    ctx.drawImage(E.img, 0, 0);

    for (var i = E.history.length - 1; i >= 0; i--) {
      if (E.history[i]) {
        ctx.putImageData(E.history[i], 0, 0);
        break;
      }
    }

    ctx.strokeStyle = '#00cc44';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  function applyBlur(p) {
    var x = Math.min(E.startX, p.x);
    var y = Math.min(E.startY, p.y);
    var w = Math.abs(p.x - E.startX);
    var h = Math.abs(p.y - E.startY);
    if (w < 2 || h < 2) return;

    var ctx = E.ctx;
    var imageData = ctx.getImageData(x, y, w, h);

    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    tempCtx.filter = 'blur(10px)';
    tempCtx.drawImage(tempCanvas, 0, 0);

    var blurred = tempCtx.getImageData(0, 0, w, h);
    ctx.putImageData(blurred, x, y);

    saveHistory();
  }

  function drawArrowhead(x1, y1, x2, y2) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var size = E.size * 4;

    E.ctx.beginPath();
    E.ctx.moveTo(x2, y2);
    E.ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    E.ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    E.ctx.closePath();
    E.ctx.fillStyle = E.color;
    E.ctx.fill();
  }

  function showTextInput(p) {
    if (E.textInput) E.textInput.remove();

    var wrapper = document.querySelector('#screenshot-editor-canvas-wrapper');
    var rect = E.canvas.getBoundingClientRect();
    var scaleX = rect.width / E.canvas.width;
    var scaleY = rect.height / E.canvas.height;

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'screenshot-text-input';
    input.style.cssText = [
      'position: absolute;',
      'left: ' + (p.x * scaleX + rect.left - wrapper.getBoundingClientRect().left) + 'px;',
      'top: ' + (p.y * scaleY + rect.top - wrapper.getBoundingClientRect().top) + 'px;',
      'z-index: 9999999;',
      'background: transparent;',
      'border: 1px dashed #00cc44;',
      'color: ' + E.color + ';',
      'font-size: ' + Math.max(16, E.size * 3) + 'px;',
      'font-family: Arial, sans-serif;',
      'outline: none;',
      'padding: 2px 4px;',
      'min-width: 40px;'
    ].join('');

    wrapper.appendChild(input);
    input.focus();

    E.textInput = input;

    var commit = function () {
      var text = input.value;
      if (text) {
        E.ctx.font = Math.max(16, E.size * 3) + 'px Arial, sans-serif';
        E.ctx.fillStyle = E.color;
        E.ctx.fillText(text, p.x, p.y + Math.max(16, E.size * 3));
        saveHistory();
      }
      input.remove();
      E.textInput = null;
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.remove(); E.textInput = null; }
    });
    input.addEventListener('blur', commit);
  }

  function saveHistory() {
    var imageData = E.ctx.getImageData(0, 0, E.w, E.h);
    E.historyIndex++;
    E.history[E.historyIndex] = imageData;
    E.history.length = E.historyIndex + 1;
  }

  function undo() {
    if (E.historyIndex <= 0) return;
    E.historyIndex--;
    E.ctx.putImageData(E.history[E.historyIndex], 0, 0);
  }

  function clearAnnotations() {
    E.ctx.clearRect(0, 0, E.w, E.h);
    E.ctx.drawImage(E.img, 0, 0);
    saveHistory();
  }

  function saveImage() {
    var dataUrl = E.canvas.toDataURL('image/png');
    chrome.runtime.sendMessage({
      action: 'downloadFile',
      dataUrl: dataUrl,
      filename: 'screenshot-' + Date.now() + '.png'
    });
  }

  function copyImage() {
    E.canvas.toBlob(function (blob) {
      if (!blob) return;
      navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]).catch(function (err) {
        console.error('Copy failed:', err);
      });
    });
  }

  function setupDrag(handle, el) {
    var offsetX, offsetY, isDragging = false;

    handle.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      var rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      handle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var containerRect = E.canvas.closest('#screenshot-editor-container').getBoundingClientRect();
      var left = e.clientX - containerRect.left - offsetX;
      var top = e.clientY - containerRect.top - offsetY;
      el.style.position = 'absolute';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'move';
      }
    });
  }
})();
