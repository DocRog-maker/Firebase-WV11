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
        fullAPI:true
      },
      viewer.current,
    ).then(async instance => {
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
    console.log('G0')

    const xfdfSigned1 = await annotationManager.exportAnnotations({ widgets: false, links: false });
    const xfdfSigned2 = await annotationManager.exportAnnotations();
    const xfdfSigned = '<?xml version="1.0" encoding="UTF-8" ?><xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve"><fields><field name="andy@aardvark"><field name="test_SIGNATURE_17380962692191"><value></value></field></field></fields><annots><ink page="0" rect="108.479,129.740,244.771,189.180" color="#000000" flags="print" name="7ae4f84e-a05c-d477-1dfc-e65d9a46be7b" title="Guest" subject="Signature" date="D:20250129093120+13\'00\'" creationdate="D:20250129093120+13\'00\'"><trn-custom-data bytes="{&quot;trn-annot-maintain-aspect-ratio&quot;:&quot;true&quot;}"/><inklist><gesture>197.74459810501386,130.42052112120018;197.74459810501386,130.42052112120018;116.199394788788,149.78017370706675;109.15952112120016,178.52632451638374;242.91712080536922,188.4994788787999;244.09043308330052,186.7395104619029;235.29059099881573,175.5930438215555;218.8642191077774,169.13982629293332;184.83816304776948,164.4465771812081;174.27835254638774,165.03323332017374;169.5851034346625,166.79320173707072;169.5851034346625,167.37985787603634;171.9317279905251,167.96651401500196;173.10504026845643,167.96651401500196</gesture></inklist></ink></annots><pages><defmtx matrix="1,0,0,-1,0,842" /></pages></xfdf>'
    const docId = doc.docId
    console.log('G0.5')
    console.log(xfdfSigned1)
    console.log('G0.6')
    console.log(xfdfSigned)
    console.log('G0.67')
    console.log(xfdfSigned2)

    annotationManager.exportAnnotations({
      widgets: false,
      links: false
      //fields: false
    }).then(annotData => {
      console.log('G0.754')
      console.log(annotData)
     })

    const docRef1 = getDocRefSimpleQuery('documentsToSign', docId)
    console.log('G0.8')
    // const docRef1 = doc(db, 'documentsToSign', docId)
    const docSnap = await getDocSnap(docRef1).catch(function (error) {
      console.log('Error getting document:', error);
    });

    console.log('G1')
    if (docSnap.exists) {
      const { signedBy, emails, xfdf, docRef } = docSnap.data();
      if (!signedBy.includes(email)) {
        const signedByArray = [...signedBy, email];
        const xfdfArray = [...xfdf, xfdfSigned];
        console.log('G2')
        await updateDocSnap(docRef1, {
          xfdf: xfdfArray,
          signedBy: signedByArray,
        });
        console.log('G3')
        if (signedByArray.length === emails.length) {
          const time = new Date();
          await updateDocSnap(docRef1, {
            signed: true,
            signedTime: time,
          });
          console.log('GG4')
          console.log('win')
          console.log(window)
          await mergeAnnotations(instance.Core, instance.Core.PDFNet, docRef, xfdfArray);
          console.log('G5')

              navigate('/');
        }
      }
    } else {
      console.log('No such document!');
    }
    console.log('G6')
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
