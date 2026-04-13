var selectedRowKeys = new Set();
var observer = null;

injectStyles();
injectCheckboxes();
startObserver();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'copySelectedRows') {
    chrome.storage.local.get(['availableFields', 'selectedFields', 'includeHeader'], function(items) {
      try {
        var table = findTable();
        if (!table) {
          sendResponse({ success: false, message: '未找到表格' });
          return;
        }

        var selectedFields = items.selectedFields && items.selectedFields.length > 0
          ? items.selectedFields
          : null;
        var includeHeader = items.includeHeader !== false;
        var keys = selectedRowKeys.size > 0 ? selectedRowKeys : null;

        var rows = extractRows(table, selectedFields, includeHeader, keys);
        if (rows.length === 0 || (rows.length === 1 && includeHeader)) {
          sendResponse({ success: false, message: '表格无数据或未选中任何行' });
          return;
        }

        var csv = generateCSV(rows, includeHeader);
        var dataRowCount = includeHeader ? rows.length - 1 : rows.length;
        sendResponse({ success: true, csv: csv, rowCount: dataRowCount });
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    });
    return true;
  }

  if (request.action === 'copyAllRows') {
    chrome.storage.local.get(['availableFields', 'selectedFields', 'includeHeader'], function(items) {
      try {
        var table = findTable();
        if (!table) {
          sendResponse({ success: false, message: '未找到表格' });
          return;
        }

        var selectedFields = items.selectedFields && items.selectedFields.length > 0
          ? items.selectedFields
          : null;
        var includeHeader = items.includeHeader !== false;

        var rows = extractRows(table, selectedFields, includeHeader, null);
        if (rows.length <= 1) {
          sendResponse({ success: false, message: '表格无数据' });
          return;
        }

        var csv = generateCSV(rows, includeHeader);
        sendResponse({ success: true, csv: csv, rowCount: rows.length - 1 });
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    });
    return true;
  }

  if (request.action === 'getSelectionCount') {
    sendResponse({ count: selectedRowKeys.size });
    return false;
  }

  if (request.action === 'updateAvailableFields') {
    chrome.storage.local.set({ availableFields: request.fields });
    return false;
  }
});

chrome.commands.onCommand.addListener(function(command) {
  if (command === 'copy-table') {
    chrome.storage.local.get(['availableFields', 'selectedFields', 'includeHeader'], function(items) {
      var table = findTable();
      if (!table) {
        alert('未找到表格');
        return;
      }

      var selectedFields = items.selectedFields && items.selectedFields.length > 0
        ? items.selectedFields
        : null;
      var includeHeader = items.includeHeader !== false;
      var keys = selectedRowKeys.size > 0 ? selectedRowKeys : null;

      var rows = extractRows(table, selectedFields, includeHeader, keys);
      if (rows.length === 0 || (rows.length === 1 && includeHeader)) {
        alert('表格无数据或未选中任何行');
        return;
      }

      var csv = generateCSV(rows, includeHeader);
      var dataRowCount = includeHeader ? rows.length - 1 : rows.length;

      navigator.clipboard.writeText(csv).then(function() {
        var label = keys ? '已复制选中 ' + dataRowCount + ' 行数据' : '已复制全部 ' + dataRowCount + ' 行数据';
        alert(label);
      }).catch(function(err) {
        alert('复制失败: ' + err.message);
      });
    });
  }
});

function injectStyles() {
  var style = document.createElement('style');
  style.id = 'stc-checkbox-styles';
  style.textContent = [
    '.stc-cb-col { width: 36px !important; min-width: 36px !important; max-width: 36px !important; text-align: center !important; padding: 4px !important; }',
    '.stc-cb-col input[type="checkbox"] { width: 16px !important; height: 16px !important; cursor: pointer; margin: 0 !important; vertical-align: middle !important; }',
    '.ant-table-fixed-left { left: 0 !important; }',
    '.ant-table-fixed-left .ant-table-body-inner { overflow: hidden !important; }'
  ].join('\n');
  var existing = document.getElementById('stc-checkbox-styles');
  if (existing) existing.remove();
  document.head.appendChild(style);
  console.log('[STC] Styles injected');
}

function startObserver() {
  observer = new MutationObserver(function() {
    var leftTable = findLeftFixedTable();
    if (!leftTable) return;
    var headerNeedsInject = !leftTable.querySelector('thead .stc-cb-col');
    var rowCount = leftTable.querySelectorAll('tbody tr[data-row-key^="tree-node-"]').length;
    var cbCount = leftTable.querySelectorAll('tbody .stc-cb-col').length;
    if (headerNeedsInject || (rowCount > 0 && cbCount < rowCount)) {
      injectCheckboxes();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function findLeftFixedTable() {
  var container = document.querySelector('.ant-table-fixed-left');
  if (!container) return null;
  return container.querySelector('table');
}

function injectCheckboxes() {
  var leftTable = findLeftFixedTable();
  if (!leftTable) {
    console.log('[STC] No left fixed table found');
    return;
  }
  console.log('[STC] Left fixed table found');

  document.querySelectorAll('.ant-table-fixed-right .stc-cb-col').forEach(function(el) {
    el.remove();
  });

  var leftContainer = document.querySelector('.ant-table-fixed-left');
  var currentWidth = leftContainer.offsetWidth;
  var hasCheckbox = !!leftTable.querySelector('thead .stc-cb-col');
  var newWidth = hasCheckbox ? currentWidth : currentWidth + 36;
  leftContainer.style.width = newWidth + 'px';

  var thead = leftTable.querySelector('thead');
  if (!thead) {
    console.log('[STC] No thead in left fixed table');
    return;
  }

  if (!thead.querySelector('.stc-cb-col')) {
    var firstTh = thead.querySelector('tr th');
    if (firstTh) {
      var colgroup = leftTable.querySelector('colgroup');
      if (colgroup) {
        var col = document.createElement('col');
        col.style.width = '36px';
        colgroup.insertBefore(col, colgroup.firstChild);
      }

      var th = document.createElement('th');
      th.className = 'stc-cb-col';
      var selectAllCb = document.createElement('input');
      selectAllCb.type = 'checkbox';
      selectAllCb.title = '全选/全不选';
      selectAllCb.addEventListener('change', function() {
        var checked = this.checked;
        var cbs = leftTable.querySelectorAll('tbody .stc-cb-col input[type="checkbox"]');
        cbs.forEach(function(cb) {
          cb.checked = checked;
          var key = cb.closest('tr').getAttribute('data-row-key');
          if (key) {
            if (checked) {
              selectedRowKeys.add(key);
            } else {
              selectedRowKeys.delete(key);
            }
          }
        });
        console.log('[STC] Select all:', checked, 'selectedRowKeys size:', selectedRowKeys.size);
      });
      th.appendChild(selectAllCb);
      firstTh.parentNode.insertBefore(th, firstTh);
      console.log('[STC] Header checkbox injected in left fixed table');
    }
  }

  var tbody = leftTable.querySelector('tbody');
  if (!tbody) {
    console.log('[STC] No tbody in left fixed table');
    return;
  }

  var rows = tbody.querySelectorAll('tr.ant-table-row[data-row-key^="tree-node-"]');
  console.log('[STC] Found', rows.length, 'rows in left fixed table');
  rows.forEach(function(tr) {
    if (tr.querySelector('.stc-cb-col')) return;
    var firstTd = tr.querySelector('td');
    if (!firstTd) return;

    var td = document.createElement('td');
    td.className = 'stc-cb-col';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    var key = tr.getAttribute('data-row-key');
    if (selectedRowKeys.has(key)) {
      cb.checked = true;
    }
    cb.addEventListener('change', function() {
      if (this.checked) {
        selectedRowKeys.add(key);
      } else {
        selectedRowKeys.delete(key);
      }
      updateSelectAllState(leftTable);
      console.log('[STC] Row checkbox changed:', key, this.checked, 'selectedRowKeys size:', selectedRowKeys.size);
    });
    td.appendChild(cb);
    firstTd.parentNode.insertBefore(td, firstTd);
  });
  console.log('[STC] injectCheckboxes completed');
}

function updateSelectAllState(leftTable) {
  var selectAllCb = leftTable.querySelector('thead .stc-cb-col input[type="checkbox"]');
  if (!selectAllCb) return;
  var allCbs = leftTable.querySelectorAll('tbody .stc-cb-col input[type="checkbox"]');
  var total = allCbs.length;
  if (total === 0) return;
  var checkedCount = 0;
  allCbs.forEach(function(cb) { if (cb.checked) checkedCount++; });
  selectAllCb.checked = checkedCount === total;
  selectAllCb.indeterminate = checkedCount > 0 && checkedCount < total;
}

function findTable() {
  var wrappers = document.querySelectorAll('.ant-table-wrapper.oui-table');
  if (wrappers.length === 0) return null;
  return wrappers[0].querySelector('table');
}

function isFixedCell(cell) {
  return cell.classList.contains('ant-table-cell-fix-left') ||
         cell.classList.contains('ant-table-cell-fix-right') ||
         cell.closest('.ant-table-cell-fix-left') ||
         cell.closest('.ant-table-cell-fix-right');
}

function getCellText(cell) {
  var keywordEl = cell.querySelector('.op-market-search-analysis-correlation-keyword');
  if (keywordEl) return keywordEl.textContent.trim();

  var valueEl = cell.querySelector('.alife-dt-card-common-table-sortable-value');
  if (valueEl) return valueEl.textContent.trim();

  var changeRateEl = cell.querySelector('.alife-dt-card-common-table-sortable-cycleCrc');
  if (changeRateEl) {
    var span = changeRateEl.querySelector('span');
    return span ? span.textContent.trim() : changeRateEl.textContent.trim();
  }

  return cell.textContent.trim().replace(/\s+/g, ' ');
}

function extractRows(table, selectedFields, includeHeader, selectedKeys) {
  var thead = table.querySelector('thead');
  var tbody = table.querySelector('tbody');
  if (!thead || !tbody) return [];

  var headerCells = thead.querySelectorAll('th');
  var headerData = [];
  var columnIndices = [];

  headerCells.forEach(function(th, idx) {
    if (th.classList.contains('stc-cb-col')) return;
    if (isFixedCell(th)) return;
    var text = th.textContent.trim().replace(/\s+/g, '');
    if (text === '操作' || text === '') return;
    headerData.push(text);
    columnIndices.push(idx);
  });

  var availableFields = headerData.filter(function(f) {
    return f !== '操作' && f !== '';
  });

  setTimeout(function() {
    chrome.storage.local.set({ availableFields: availableFields });
  }, 1000);

  var rows = [];
  var useFieldFilter = selectedFields !== null;

  if (includeHeader) {
    var headerRow = useFieldFilter
      ? headerData.filter(function(h) { return selectedFields.indexOf(h) !== -1; })
      : headerData.slice();
    rows.push(headerRow);
  }

  var dataRows = tbody.querySelectorAll('tr.ant-table-row[data-row-key^="tree-node-"]');
  dataRows.forEach(function(tr) {
    var rowKey = tr.getAttribute('data-row-key');
    if (selectedKeys !== null && selectedKeys.size > 0 && !selectedKeys.has(rowKey)) return;

    var cells = tr.querySelectorAll('td');
    var rowData = [];
    columnIndices.forEach(function(colIdx) {
      var cell = cells[colIdx];
      if (!cell || isFixedCell(cell) || cell.classList.contains('stc-cb-col')) return;
      var fieldName = headerData[columnIndices.indexOf(colIdx)];
      if (useFieldFilter && selectedFields.indexOf(fieldName) === -1) return;
      rowData.push(getCellText(cell));
    });
    if (rowData.length > 0) {
      rows.push(rowData);
    }
  });

  return rows;
}

function generateCSV(rows, includeHeader) {
  var text = rows.map(function(row) {
    return row.join('\t');
  }).join('\n');
  return '\uFEFF' + text;
}
