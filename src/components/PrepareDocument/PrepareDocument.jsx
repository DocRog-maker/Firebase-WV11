import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigate } from '@reach/router';
import {
  Box,
  Column,
  Heading,
  Row,
  Stack,
  Text,
  Button,
  SelectList,
} from 'gestalt';
import { selectAssignees, resetSignee } from '../Assign/AssignSlice';
import { addDocumentToSign, uploadBytesToDocRef, getDocRef } from '../../firebase/firebase';
import { selectUser } from '../../firebase/firebaseSlice';
import WebViewer from '@pdftron/webviewer';
import 'gestalt/dist/gestalt.css';
import './PrepareDocument.css';


const PrepareDocument = () => {
  const [instance, setInstance] = useState(null);
  const [fieldsApplied, setFieldsApplied] = useState(false);
  const dispatch = useDispatch();

  const assignees = useSelector(selectAssignees);
  const assigneesValues = assignees.map(user => {
    return { value: user.email, label: user.name };
  });
  let initialAssignee =
    assigneesValues.length > 0 ? assigneesValues[0].value : '';
  const [assignee, setAssignee] = useState(initialAssignee);

  const user = useSelector(selectUser);
  const { uid, email } = user;

  const viewer = useRef(null);
  const filePicker = useRef(null);

  // if using a class, equivalent of componentDidMount
  useEffect(() => {
    WebViewer(
      {
        path: 'webviewer',
        ui: 'legacy',
        disabledElements: [
          'ribbons',
          'toggleNotesButton',
          'searchButton',
          'menuButton',
        ],
      },
      viewer.current,
    ).then(instance => {

      // select only the view group
      instance.UI.setToolbarGroup('toolbarGroup-View');

      setInstance(instance);

      filePicker.current.onchange = e => {
        const file = e.target.files[0];
        if (file) {
          instance.UI.loadDocument(file);
        }
      };
    });
  }, []);

  const applyFields = async () => {
    const { Annotations, documentViewer } = instance.Core;
    const annotationManager = documentViewer.getAnnotationManager();
    const fieldManager = annotationManager.getFieldManager();
    const annotationsList = annotationManager.getAnnotationsList();
    const annotsToDelete = [];
    const annotsToDraw = [];

    await Promise.all(
      annotationsList.map(async (annot, index) => {
        let inputAnnot;
        let field;

        if (typeof annot.custom !== 'undefined') {
          // create a form field based on the type of annotation
          if (annot.custom.type === 'TEXT') {
            field = new Annotations.Forms.Field(
              annot.getContents() + Date.now() + index,
              {
                type: 'Tx',
                value: annot.custom.value,
              },
            );
            inputAnnot = new Annotations.TextWidgetAnnotation(field);
          } else if (annot.custom.type === 'SIGNATURE') {
            field = new Annotations.Forms.Field(
              annot.getContents() + Date.now() + index,
              {
                type: 'Sig',
              },
            );
            inputAnnot = new Annotations.SignatureWidgetAnnotation(field, {
              appearance: '_DEFAULT',
              appearances: {
                _DEFAULT: {
                  Normal: {
                    data:
                      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjEuMWMqnEsAAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC',
                    offset: {
                      x: 100,
                      y: 100,
                    },
                  },
                },
              },
            });
          } else if (annot.custom.type === 'DATE') {
            field = new Annotations.Forms.Field(
              annot.getContents() + Date.now() + index,
              {
                type: 'Tx',
                value: 'm-d-yyyy',
                // Actions need to be added for DatePickerWidgetAnnotation to recognize this field.
                actions: {
                  F: [
                    {
                      name: 'JavaScript',
                      // You can customize the date format here between the two double-quotation marks
                      // or leave this blank to use the default format
                      javascript: 'AFDate_FormatEx("mmm d, yyyy");',
                    },
                  ],
                  K: [
                    {
                      name: 'JavaScript',
                      // You can customize the date format here between the two double-quotation marks
                      // or leave this blank to use the default format
                      javascript: 'AFDate_FormatEx("mmm d, yyyy");',
                    },
                  ],
                },
              },
            );

            inputAnnot = new Annotations.DatePickerWidgetAnnotation(field);
          } else {
            // exit early for other annotations
            annotationManager.deleteAnnotation(annot, false, true); // prevent duplicates when importing xfdf
            return;
          }
        } else {
          // exit early for other annotations
          return;
        }

        // set position
        inputAnnot.PageNumber = annot.getPageNumber();
        inputAnnot.X = annot.getX();
        inputAnnot.Y = annot.getY();
        inputAnnot.rotation = annot.Rotation;
        if (annot.Rotation === 0 || annot.Rotation === 180) {
          inputAnnot.Width = annot.getWidth();
          inputAnnot.Height = annot.getHeight();
        } else {
          inputAnnot.Width = annot.getHeight();
          inputAnnot.Height = annot.getWidth();
        }

        // delete original annotation
        annotsToDelete.push(annot);

        // customize styles of the form field
        Annotations.WidgetAnnotation.getCustomStyles = function (widget) {
          if (widget instanceof Annotations.SignatureWidgetAnnotation) {
            return {
              border: '1px solid #a5c7ff',
            };
          }
        };
        Annotations.WidgetAnnotation.getCustomStyles(inputAnnot);

        // draw the annotation the viewer
        annotationManager.addAnnotation(inputAnnot);
        fieldManager.addField(field);
        annotsToDraw.push(inputAnnot);
      }),
      setFieldsApplied(true)
    );

    // delete old annotations
    annotationManager.deleteAnnotations(annotsToDelete, null, true);

    // refresh viewer
    await annotationManager.drawAnnotationsFromList(annotsToDraw);
  }

  const upload = async () => {
    // If the user hasn't pressed the ApplyFields button then do it here
    // It can be done as a single step, but it's interesting to see what happens, so I have split it into two
    if (!fieldsApplied){
      await applyFields();
    }
    await uploadForSigning();
  };

  const addField = (type, point = {}, name = '', value = '', flag = {}) => {
    const { documentViewer, Annotations } = instance.Core;
    const annotationManager = documentViewer.getAnnotationManager();
    const doc = documentViewer.getDocument();
    const displayMode = documentViewer.getDisplayModeManager().getDisplayMode();
    const page = displayMode.getSelectedPages(point, point);
    if (!!point.x && page.first == null) {
      return; //don't add field to an invalid page location
    }
    const page_idx =
      page.first !== null ? page.first : documentViewer.getCurrentPage();
    const page_info = doc.getPageInfo(page_idx);
    const page_point = displayMode.windowToPage(point, page_idx);
    const zoom = documentViewer.getZoomLevel();

    var textAnnot = new Annotations.FreeTextAnnotation();
    textAnnot.PageNumber = page_idx;
    const rotation = documentViewer.getCompleteRotation(page_idx) * 90;
    textAnnot.Rotation = rotation;
    if (rotation === 270 || rotation === 90) {
      textAnnot.Width = 50.0 / zoom;
      textAnnot.Height = 250.0 / zoom;
    } else {
      textAnnot.Width = 250.0 / zoom;
      textAnnot.Height = 50.0 / zoom;
    }
    textAnnot.X = (page_point.x || page_info.width / 2) - textAnnot.Width / 2;
    textAnnot.Y = (page_point.y || page_info.height / 2) - textAnnot.Height / 2;

    textAnnot.setPadding(new Annotations.Rect(0, 0, 0, 0));
    textAnnot.custom = {
      type,
      value,
      flag,
      name: `${assignee}_${type}_`,
    };

    // set the type of annot
    textAnnot.setContents(textAnnot.custom.name);
    textAnnot.FontSize = '' + 20.0 / zoom + 'px';
    textAnnot.FillColor = new Annotations.Color(211, 211, 211, 0.5);
    textAnnot.TextColor = new Annotations.Color(0, 165, 228);
    textAnnot.StrokeThickness = 1;
    textAnnot.StrokeColor = new Annotations.Color(0, 165, 228);
    textAnnot.TextAlign = 'center';

    textAnnot.Author = annotationManager.getCurrentUser();

    annotationManager.deselectAllAnnotations();
    annotationManager.addAnnotation(textAnnot, true);
    annotationManager.redrawAnnotation(textAnnot);
    annotationManager.selectAnnotation(textAnnot);
  };

  const uploadForSigning = async () => {
    // upload the PDF with fields as AcroForm

    const referenceString = `docToSign/${uid}${Date.now()}.pdf`;
    const docRef = getDocRef(referenceString);
    const { documentViewer, annotationManager } = instance.Core;
    const doc = documentViewer.getDocument();
    const xfdfString = await annotationManager.exportAnnotations({ widgets: true, fields: true });
    const data = await doc.getFileData({ xfdfString });
    const arr = new Uint8Array(data);
    const blob = new Blob([arr], { type: 'application/pdf' });
    await uploadBytesToDocRef(docRef, blob)

    // create an entry in the database
    const emails = assignees.map(assignee => {
      return assignee.email;
    });
    await addDocumentToSign(uid, email, referenceString, emails);
    dispatch(resetSignee());
    navigate('/');
  };

  return (
    <div className={'prepareDocument'}>
      <Box display="flex" direction="row" flex="grow">
        <Column span={2}>
          <Box padding={3}>
            <Heading size="md">Prepare Document</Heading>
          </Box>
          <Box padding={3}>
            <Row gap={1}>
              <Stack>
                <Box padding={2}>
                  <Text>{'Step 1'}</Text>
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={() => {
                      if (filePicker) {
                        filePicker.current.click();
                      }
                    }}
                    accessibilityLabel="upload a document"
                    text="Upload a document"
                    iconEnd="add-circle"
                  />
                </Box>
              </Stack>
            </Row>
            <Row>
              <Stack>
                <Box padding={2}>
                  <Text>{'Step 2'}</Text>
                </Box>
                <Box padding={2}>
                  <SelectList
                    id="assigningFor"
                    name="assign"
                    onChange={({ value }) => setAssignee(value)}
                    options={assigneesValues}
                    placeholder="Select recipient"
                    label="Adding signature for"
                    value={assignee}
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={() => addField('SIGNATURE')}
                    accessibilityLabel="add signature"
                    text="Add signature"
                    iconEnd="compose"
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={() => addField('TEXT')}
                    accessibilityLabel="add text"
                    text="Add text"
                    iconEnd="text-sentence-case"
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={() => addField('DATE')}
                    accessibilityLabel="add date field"
                    text="Add date"
                    iconEnd="calendar"
                  />
                </Box>
              </Stack>
            </Row>
            <Row gap={1}>
              <Stack>
                <Box padding={2}>
                  <Text>{'Step 3'}</Text>
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={applyFields}
                    accessibilityLabel="ApplyFields"
                    text="Apply Fields"
                    iconEnd="cog"
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={upload}
                    accessibilityLabel="Upload"
                    text="Send"
                    iconEnd="send"
                  />
                </Box>
              </Stack>
            </Row>
          </Box>
        </Column>
        <Column span={10}>
          <div className="webviewer" ref={viewer}></div>
        </Column>
      </Box>
      <input type="file" ref={filePicker} style={{ display: 'none' }} accept="application/pdf"/>
    </div>
  );
};

export default PrepareDocument;
