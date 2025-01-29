import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { navigate } from '@reach/router';
import { Box, Column, Heading, Row, Stack, Button } from 'gestalt';
import { selectDocToSign } from './SignDocumentSlice';
import { getURL, getDocRefSimpleQuery, getDocSnap, updateDocSnap } from '../../firebase/firebase';
import { mergeAnnotations } from '../MergeAnnotations/MergeAnnotations';
import { selectUser } from '../../firebase/firebaseSlice';
import WebViewer from '@pdftron/webviewer';
import 'gestalt/dist/gestalt.css';
import './SignDocument.css';

const SignDocument = () => {
  const [annotationManager, setAnnotationManager] = useState(null);
  const [annotPosition, setAnnotPosition] = useState(0);
  const [instance, setInstance] = useState(null);

  const doc = useSelector(selectDocToSign);
  const user = useSelector(selectUser);
  const { email } = user;
  const viewer = useRef(null);

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
          'rubberStampToolGroupButton',
          'stampToolGroupButton',
          'fileAttachmentToolGroupButton',
          'calloutToolGroupButton',
          'undo',
          'redo',
          'eraserToolButton'
        ],
        fullAPI: true
      },
      viewer.current,
    ).then(async instance => {
      const tool = instance.Core.documentViewer.getTool('AnnotationCreateSignature');
      tool.setSigningMode(instance.Core.Tools.SignatureCreateTool.SigningModes.ANNOTATION);

      if (doc) {

        const { documentViewer, annotationManager, Annotations } = instance.Core;
        setAnnotationManager(annotationManager);
        setInstance(instance);

        // select only the insert group
        instance.UI.setToolbarGroup('toolbarGroup-Insert');

        // load document
        const docRef = doc.docRef
        const URL = await getURL(docRef);
        documentViewer.loadDocument(URL);

        const normalStyles = (widget) => {
          if (widget instanceof Annotations.TextWidgetAnnotation) {
            return {
              'background-color': '#a5c7ff',
              color: 'white',
            };
          } else if (widget instanceof Annotations.SignatureWidgetAnnotation) {
            return {
              border: '1px solid #a5c7ff',
            };
          }
        };

        annotationManager.addEventListener('annotationChanged', (annotations, action, { imported }) => {
          if (imported && action === 'add') {
            annotations.forEach(function (annot) {
              if (annot instanceof Annotations.WidgetAnnotation) {
                Annotations.WidgetAnnotation.getCustomStyles = normalStyles;
                if (!annot.fieldName.startsWith(email)) {
                  annot.Hidden = true;
                  annot.Listable = false;
                }
              }
            });
          }
        });
      }
    });
  }, [doc, email]);

  const nextField = () => {

    let annots = annotationManager.getAnnotationsList();
    if (annots[annotPosition]) {
      annotationManager.jumpToAnnotation(annots[annotPosition]);
      if (annots[annotPosition + 1]) {
        setAnnotPosition(annotPosition + 1);
      }
    }
  }

  const prevField = () => {
    let annots = annotationManager.getAnnotationsList();
    if (annots[annotPosition]) {
      annotationManager.jumpToAnnotation(annots[annotPosition]);
      if (annots[annotPosition - 1]) {
        setAnnotPosition(annotPosition - 1);
      }
    }
  }

  const completeSigning = async () => {
    const xfdfSigned = await annotationManager.exportAnnotations({ widgets: false, links: false });
    const docId = doc.docId

    const docRef1 = getDocRefSimpleQuery('documentsToSign', docId)

    const docSnap = await getDocSnap(docRef1).catch(function (error) {
      console.log('Error getting document:', error);
    });


    if (docSnap.exists) {
      const { signedBy, emails, xfdf, docRef } = docSnap.data();
      if (!signedBy.includes(email)) {
        const signedByArray = [...signedBy, email];
        const xfdfArray = [...xfdf, xfdfSigned];

        await updateDocSnap(docRef1, {
          xfdf: xfdfArray,
          signedBy: signedByArray,
        });

        if (signedByArray.length === emails.length) {
          const time = new Date();
          await updateDocSnap(docRef1, {
            signed: true,
            signedTime: time,
          });

          await mergeAnnotations(instance.Core, instance.Core.PDFNet, docRef, xfdfArray);

          navigate('/');
        }
      }
    } else {
      console.log('No such document!');
    }
  };

  return (
    <div className={'prepareDocument'}>
      <Box display="flex" direction="row" flex="grow">
        <Column span={2}>
          <Box padding={3}>
            <Heading size="md">Sign Document</Heading>
          </Box>
          <Box padding={3}>
            <Row gap={1}>
              <Stack>
                <Box padding={2}>
                  <Button
                    onClick={nextField}
                    accessibilityLabel="next field"
                    text="Next field"
                    iconEnd="arrow-forward"
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={prevField}
                    accessibilityLabel="Previous field"
                    text="Previous field"
                    iconEnd="arrow-back"
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={completeSigning}
                    accessibilityLabel="complete signing"
                    text="Complete signing"
                    iconEnd="compose"
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
    </div>
  );
};

export default SignDocument;
