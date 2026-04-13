document.addEventListener('DOMContentLoaded', function() {
  const fieldList = document.getElementById('fieldList');
  const savedMsg = document.getElementById('saved');
  const includeHeaderCheckbox = document.getElementById('includeHeader');

  let fieldToggles = {};

  function renderFields(fields, enabledFields) {
    fieldList.innerHTML = '';
    fieldToggles = {};

    fields.forEach(function(field) {
      const item = document.createElement('div');
      item.className = 'field-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'field-name';
      nameSpan.textContent = field;

      const label = document.createElement('label');
      label.className = 'toggle';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = enabledFields.indexOf(field) !== -1;
      checkbox.dataset.field = field;

      const slider = document.createElement('span');
      slider.className = 'toggle-slider';

      label.appendChild(checkbox);
      label.appendChild(slider);
      item.appendChild(nameSpan);
      item.appendChild(label);
      fieldList.appendChild(item);

      fieldToggles[field] = checkbox;

      checkbox.addEventListener('change', save);
    });
  }

  function save() {
    const enabled = Object.keys(fieldToggles).filter(function(key) {
      return fieldToggles[key].checked;
    });
    chrome.storage.local.set({
      selectedFields: enabled,
      includeHeader: includeHeaderCheckbox.checked
    }, function() {
      savedMsg.classList.add('show');
      setTimeout(function() {
        savedMsg.classList.remove('show');
      }, 1500);
    });
  }

  chrome.storage.local.get(['availableFields', 'selectedFields', 'includeHeader'], function(items) {
    const defaultFields = [
      '相关搜索词',
      '搜索人气',
      '搜索人气变化率',
      '点击率',
      '点击率变化率',
      '支付转化率',
      '支付转化率变化率'
    ];

    let available = defaultFields.slice();
    if (items.availableFields && items.availableFields.length > 0) {
      items.availableFields.forEach(function(f) {
        if (available.indexOf(f) === -1) {
          available.push(f);
        }
      });
    }

    const selected = items.selectedFields && items.selectedFields.length > 0
      ? items.selectedFields
      : available.slice();

    includeHeaderCheckbox.checked = items.includeHeader !== false;

    renderFields(available, selected);
  });

  includeHeaderCheckbox.addEventListener('change', save);
});