var MyBook = SpreadsheetApp.openById("シート番号")

const id2row = (sheet, id) =>
{
  let range = sheet.getRange(1, 1, sheet.getMaxRows(), 1)
  let cells = range.createTextFinder(id).findAll()
  if(cells.length > 0){
    for(let cell of cells){
      if(cell.getValue() == id){
        return cell.getRow()
      }
    }
  }
  return -1
}
const createJson = data => {
  let output = ContentService.createTextOutput()
  output.setMimeType(ContentService.MimeType.JSON)
  output.setContent(JSON.stringify(data))

  return output
}
const getFavoriteByUrl = parameter => {
  let sheet = MyBook.getSheetByName(parameter.uid)
  let objects = []
  if(sheet != null){
      const values = sheet.getDataRange().getValues()
      const headers = values.shift()
      for (const row of values) {
        const object = {}
        for (const [index, value] of headers.entries()) {
          object[value] = row[index]
        }
        if(object["url"] == parameter.url){
          objects.push(object)
        }
      }
  }
  return createJson({ values: objects })
}
const getFavorites = parameter => {
  let sheet = MyBook.getSheetByName(parameter.uid)
  let objects = []
  if(sheet != null){
      const values = sheet.getDataRange().getValues()
      const headers = values.shift()
      for (const row of values) {
        const object = {}
        for (const [index, value] of headers.entries()) {
          object[value] = row[index]
        }
        objects.push(object)
      }
  }
  return createJson({ values: objects })
}
const deleteFavorite = parameter => {
  let ret = false
  let sheet = MyBook.getSheetByName(parameter.uid)
  const lock = LockService.getScriptLock()
  if(lock.tryLock(30000)){
    try {
      let id = parameter.id
      if(sheet != null && id){
        let row = id2row(sheet, id)
        if(row > 0){
          sheet.deleteRow(row)
          ret = true
        }
      }
    } catch(e) {
    } finally {
      lock.releaseLock()
    }
  }
  return createJson({ result: ret })
}
const updateFavorite = parameter => {
  let ret = false
  let sheet = MyBook.getSheetByName(parameter.uid)
  let id = parameter.id
  const lock = LockService.getScriptLock()
  if(lock.tryLock(30000)){
    try {
      if(sheet != null && id){
        let row = id2row(sheet, id)
        if(row > 0){
          let values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0]
          let col = 0
          for(const key of sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]){
            if(key != "id" && key in parameter){
              values[col] = parameter[key]
            }
            ++col
          }
          sheet.getRange(row, 1, 1, values.length).setValues([values])
          ret = true
        }
      }
    } catch(e) {
    } finally {
      lock.releaseLock()
    }
  }
  return createJson({ result: ret })
}
const addFavorite = parameter => {
  let ret = false
  let sheet = MyBook.getSheetByName(parameter.uid)
  const lock = LockService.getScriptLock()
  if(lock.tryLock(30000)){
    try {
      if(sheet != null){
        let values = []
        let lastRow = sheet.getLastRow()
        console.log(lastRow)
        if(lastRow == 0){
          sheet.appendRow(["id", "name", "author", "url", "cur_page", "max_page", "cur_url"])
        }
        for(const key of sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]){
          values.push(parameter[key]||"")
        }
        let array = [].concat(...sheet.getRange(2,1,sheet.getLastRow()).getValues())
        var max = 0
        for (var i = 0, l = array.length; i < l; i++) {
            var n = array[i]
            if (n != null && !isNaN(n) && typeof n === "number") {
                if (max) {
                    max = Math.max(max, n)
                } else {
                    max = n
                }
            }
        }
        values[0] = max + 1
        sheet.appendRow(values)
        ret = true
      }
    } catch(e) {
    } finally {
      lock.releaseLock()
    }
  }
  return createJson({ result: ret })
}

function doGet(e) {
  let parameter = e.parameter
  switch(parameter.func){
  case 'get_favorite_by_url': return getFavoriteByUrl(parameter)
  case 'get_favorites': return getFavorites(parameter)
  case 'delete_favorite': return deleteFavorite(parameter)
  case 'update_favorite': return updateFavorite(parameter)
  case 'add_favorite': return addFavorite(parameter)
  }
  var url = e.parameter.url
  let charset = e.parameter.charset
  if(!charset){
    charset = 'UTF-8'
  }
  if(charset == "Auto"){
    let content = UrlFetchApp.fetch(url).getBlob()
    let utf8 = content.getDataAsString()
    if(utf8.match(/charset.*shift/i)){
      utf8 = content.getDataAsString("Shift-JIS")
    } else if(utf8.match(/charset.*euc/i)){
      utf8 = content.getDataAsString("euc-jp")
    }
    return ContentService
      .createTextOutput(utf8)
      .setMimeType(ContentService.MimeType.TEXT)
  } else {
    return ContentService
      .createTextOutput(
        UrlFetchApp.fetch(url).getContentText(charset)
      )
      .setMimeType(ContentService.MimeType.TEXT)
  }
}