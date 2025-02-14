import React, { useEffect, useState } from 'react';
import { Button, Table, Text, Spinner } from 'gestalt';
import 'gestalt/dist/gestalt.css';
import { useSelector, useDispatch } from 'react-redux';
import { searchForDocumentsSigned } from '../../firebase/firebase';
import { selectUser } from '../../firebase/firebaseSlice';
import { setDocToView } from '../ViewDocument/ViewDocumentSlice';
import { navigate } from '@reach/router';

const SignedList = () => {
  const user = useSelector(selectUser);
  const { email } = user;
  const [docs, setDocs] = useState([]);
  const [show, setShow] = useState(true);

  const dispatch = useDispatch();

  useEffect(() => {
    async function getDocs() {
      const docsToView = await searchForDocumentsSigned(email);
      setDocs(docsToView);
      setShow(false);
    }
    setTimeout(getDocs, 1000);
  }, [email]);

  function pad(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
  }
  const getTime = (signedTime) => {
    const t = signedTime * 1000;
    const dt = new Date(t);
    const res = dt.toDateString() + ' at ' + pad(dt.getHours(), 2) + ':' + pad(dt.getMinutes(), 2)
    return res
  }
  return (
    <div>
      {show ? (
        <Spinner show={show} accessibilityLabel="spinner" />
      ) : (
        <div>
          {docs.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>
                    <Text weight="bold">From</Text>
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    <Text weight="bold">When</Text>
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {docs.map(doc => (
                  <Table.Row key={doc.docRef}>
                    <Table.Cell>
                      {doc.emails.map(email => (
                        <Text key={email}>{email}</Text>
                      ))}
                    </Table.Cell>
                    <Table.Cell>
                      <Text>{doc.signedTime ? getTime(doc.signedTime.seconds) : ''}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        onClick={event => {
                          const { docRef, docId } = doc;
                          dispatch(setDocToView({ docRef, docId }));
                          navigate(`/viewDocument`);
                        }}
                        text="View"
                        color="blue"
                        inline
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            'You do not have any documents to review'
          )}
        </div>
      )}
    </div>
  );
};

export default SignedList;
