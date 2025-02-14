import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { navigate } from '@reach/router';
import { Box, Column, Heading, Row, Stack, Button } from 'gestalt';
import { selectDocToView } from './ViewDocumentSlice';
import { getURL } from '../../firebase/firebase';
import WebViewer from '@pdftron/webviewer';
import 'gestalt/dist/gestalt.css';
import './ViewDocument.css';

const ViewDocument = () => {
  const [instance, setInstance] = useState(null);

  const doc = useSelector(selectDocToView);
  if (!doc) {
    console.log('No doc');
    navigate('/')
  }
  const viewer = useRef(null);

  useEffect(() => {
    WebViewer(
      {
        path: 'webviewer',
        ui: 'legacy',
        disabledElements: [
          'ribbons',
          'toggleNotesButton',
          'contextMenuPopup',
        ],
      },
      viewer.current,
    ).then(async instance => {
      if (doc) {
        // select only the view group
        instance.UI.setToolbarGroup('toolbarGroup-View');

        setInstance(instance);
        const { docRef } = doc;
        const URL = await getURL(docRef)
        await instance.Core.documentViewer.loadDocument(URL);
      }
    }
    );
  }, [doc]);

  const download = () => instance.UI.downloadPdf(true);

  const doneViewing = async () => {
    navigate('/');
  }

  return (
    <div className={'prepareDocument'}>
      <Box display="flex" direction="row" flex="grow">
        <Column span={2}>
          <Box padding={3}>
            <Heading size="md">View Document</Heading>
          </Box>
          <Box padding={3}>
            <Row gap={1}>
              <Stack>
                <Box padding={2}>
                  <Button
                    onClick={download}
                    accessibilityLabel="download signed document"
                    text="Download"
                    iconEnd="download"
                  />
                </Box>
                <Box padding={2}>
                  <Button
                    onClick={doneViewing}
                    accessibilityLabel="complete signing"
                    text="Done viewing"
                    iconEnd="check"
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

export default ViewDocument;
