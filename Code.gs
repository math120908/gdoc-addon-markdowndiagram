/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that this add-on will only
 * attempt to read or modify the files in which the add-on is used,
 * and not all of the user's files. The authorization request message
 * presented to users will reflect this limited scope.
 */

/**
 * Creates a menu entry in the Google Docs UI when the document is opened.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Open Sidebar', 'showSidebar')
      .addSeparator()
      //.addItem('Text to Diagram', 'showSidebar')
      //.addItem('Diagram to Text', 'insertText')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar in the document containing the add-on's user interface.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 */
function showSidebar() {
  var ui = HtmlService.createTemplateFromFile('Sidebar').evaluate().setTitle('MarkdownDiagram Converter');
  DocumentApp.getUi().showSidebar(ui);
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

/**
 * Gets the text the user has selected. If there is no selection,
 * this function displays an error message.
 *
 * @return {Array.<string>} The selected text.
 */
function getSelectedText() {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    var text = [];
    var elements = selection.getSelectedElements();
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].isPartial()) {
        var element = elements[i].getElement().asText();
        var startIndex = elements[i].getStartOffset();
        var endIndex = elements[i].getEndOffsetInclusive();
        text.push(element.getText().substring(startIndex, endIndex + 1));
      } else {
        var element = elements[i].getElement();
        // Only translate elements that can be edited as text; skip images and
        // other non-text elements.
        if (element.editAsText) {
          var elementText = element.asText().getText();
          // This check is necessary to exclude images, which return a blank
          // text element.
          if (elementText != '') {
            text.push(elementText);
          }
        }
      }
    }
    if (text.length == 0) {
      throw 'Please select some text.';
    }
    return text.join('\n').split('\r').join('\n');
  } else {
    throw 'Please select some text.';
  }
}

function getSelectedInlineImage () {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    var elements = selection.getRangeElements();
    if (elements.length == 1 && elements[0].getElement().getType() == DocumentApp.ElementType.INLINE_IMAGE) {
      var inlineImage = elements[0].getElement().asInlineImage();
      if ( inlineImage ){
        return inlineImage;
      }
    }
  }
  throw "Please select an image";
}

function getSelectedInlineImageLink() {
  var inlineImage = getSelectedInlineImage();
  var linkUrl = inlineImage.getLinkUrl();
  if ( linkUrl ){
    return linkUrl;
  } else {
    throw "Selected image cannot reference source."
  }
}

function getPreferences() {
  var userProperties = PropertiesService.getUserProperties();
  var textDiagramPrefs = {
    engine: userProperties.getProperty('engine'),
    extra_data: userProperties.getProperty('extra_data')
  };
  return textDiagramPrefs;
}

function getTextAndTranslation(origin, dest, savePrefs) {
  var result = {};
  var text = getSelectedText();
  result['text'] = text.join('\n');

  if (savePrefs == true) {
    var userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('originLang', origin);
    userProperties.setProperty('destLang', dest);
  }

  result['translation'] = translateText(result['text'], origin, dest);

  return result;
}


function insertDiagram(imgDataUrl, imgEditLinkUrl) {
  var imgBlob = Utilities.newBlob(Utilities.base64Decode(imgDataUrl), MimeType.PNG);

  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  if (selection) {
    var elements = selection.getSelectedElements();
    var parent = elements[0].getElement().getParent();
    for (var i = 0; i< elements.length; i++) {
      var element = elements[i].getElement();
      element.removeFromParent();
    }
    var newPosition = doc.newPosition(parent, 0);
    doc.setCursor(newPosition);
  }
  var cursor = doc.getCursor();
  var inlineImage = cursor.insertInlineImage(imgBlob);
  inlineImage.setLinkUrl(imgEditLinkUrl);

  var body = doc.getBody();
  var width = body.getPageWidth();
  if (inlineImage.getWidth() > width) {
    var height = width / inlineImage.getWidth() * inlineImage.getHeight();
    inlineImage.setHeight(height);
    inlineImage.setWidth(width);
  }
  return true;
}

function insertText(text) {
  var inlineImage = getSelectedInlineImage();
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();

  var index = body.getChildIndex(inlineImage.getParent());
  body.insertParagraph(index, text);
  inlineImage.removeFromParent();
}