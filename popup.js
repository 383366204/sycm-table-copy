document.addEventListener('DOMContentLoaded', function() {
  var status = document.getElementById('status');
  var copySelectedBtn = document.getElementById('copySelectedBtn');
  var copyAllBtn = document.getElementById('copyAllBtn');
  var settingsToggle = document.getElementById('settingsToggle');
  var settingsArrow = document.getElementById('settingsArrow');
  var settingsBody = document.getElementById('settingsBody');
  var fieldList = document.getElementById('fieldList');
  var includeHeaderCheckbox = document.getElementById('includeHeader');

  var fieldToggles = {};

  settingsToggle.addEventListener('click', function() {
    var collapsed = settingsBody.classList.contains('collapsed');
    if (collapsed) {
      settingsBody.classList.remove('collapsed');
      settingsBody.style.maxHeight = settingsBody.scrollHeight + 'px';
      settingsArrow.classList.remove('collapsed');
    } else {
      settingsBody.classList.add('collapsed');
      settingsArrow.classList.add('collapsed');
    }
  });

  function renderFields(fields, enabledFields) {
    fieldList.innerHTML = '';
    fieldToggles = {};

    fields.forEach(function(field) {
      var item = document.createElement('div');
      item.className = 'field-item';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'field-name';
      nameSpan.textContent = field;

      var label = document.createElement('label');
      label.className = 'toggle';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = enabledFields.indexOf(field) !== -1;
      checkbox.dataset.field = field;

      var slider = document.createElement('span');
      slider.className = 'toggle-slider';

      label.appendChild(checkbox);
      label.appendChild(slider);
      item.appendChild(nameSpan);
      item.appendChild(label);
      fieldList.appendChild(item);

      fieldToggles[field] = checkbox;
      checkbox.addEventListener('change', saveSettings);
    });
  }

  function saveSettings() {
    var enabled = Object.keys(fieldToggles).filter(function(key) {
      return fieldToggles[key].checked;
    });
    chrome.storage.local.set({
      selectedFields: enabled,
      includeHeader: includeHeaderCheckbox.checked
    });
  }

  includeHeaderCheckbox.addEventListener('change', saveSettings);

  chrome.storage.local.get(['availableFields', 'selectedFields', 'includeHeader'], function(items) {
    var defaultFields = [
      '相关搜索词',
      '搜索人气',
      '搜索人气变化率',
      '点击率',
      '点击率变化率',
      '支付转化率',
      '支付转化率变化率'
    ];

    var available = defaultFields.slice();
    if (items.availableFields && items.availableFields.length > 0) {
      items.availableFields.forEach(function(f) {
        if (available.indexOf(f) === -1) {
          available.push(f);
        }
      });
    }

    var selected = items.selectedFields && items.selectedFields.length > 0
      ? items.selectedFields
      : available.slice();

    includeHeaderCheckbox.checked = items.includeHeader !== false;
    renderFields(available, selected);
  });

  updateSelectionCount();

  async function updateSelectionCount() {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return;
      var resp = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectionCount' });
      if (resp && resp.count > 0) {
        status.textContent = '已选 ' + resp.count + ' 行';
      } else {
        status.textContent = '未选中行（快捷键复制全部）';
      }
    } catch (e) {
      status.textContent = '请打开生意参谋页面';
    }
  }

  copySelectedBtn.addEventListener('click', async function() {
    try {
      status.className = 'status';
      status.textContent = '正在复制...';

      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'copySelectedRows' });

      if (!response.success) {
        status.className = 'status error';
        status.textContent = response.message || '复制失败';
        return;
      }

      await navigator.clipboard.writeText(response.csv);
      status.className = 'status ready';
      status.textContent = '已复制选中 ' + response.rowCount + ' 行数据';
    } catch (err) {
      status.className = 'status error';
      status.textContent = '页面未响应，请刷新重试';
    }
  });

  copyAllBtn.addEventListener('click', async function() {
    try {
      status.className = 'status';
      status.textContent = '正在复制...';

      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'copyAllRows' });

      if (!response.success) {
        status.className = 'status error';
        status.textContent = response.message || '复制失败';
        return;
      }

      await navigator.clipboard.writeText(response.csv);
      status.className = 'status ready';
      status.textContent = '已复制全部 ' + response.rowCount + ' 行数据';
    } catch (err) {
      status.className = 'status error';
      status.textContent = '页面未响应，请刷新重试';
    }
  });
});
