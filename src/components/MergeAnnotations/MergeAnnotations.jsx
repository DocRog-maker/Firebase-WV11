import { getURL, uploadBytesToChild } from '../../firebase/firebase';
import WebViewer from '@pdftron/webviewer';
import WebViewerInstance from '@pdftron/webviewer';
import Core from '@pdftron/webviewer'

export const mergeAnnotations = async (Core, PDFNet, docRef, xfdf) => {
  //const Core = window.Core;
  console.log('window');
  console.log(window)
  console.log('core')
  console.log(Core)
 // const PDFNet = window.Core.PDFNet;
 //const PDFNet = WebViewer.PDFNet;

 //WebViewer.setWorkerPath('./webviewer/core');
 Core.setWorkerPath('./webviewer/core');
  
  const URL = await  getURL(docRef)
  const main = async () => {
    const doc = await PDFNet.PDFDoc.createFromURL(URL);
    doc.initSecurityHandler();

    let i;
    for (i=0; i < xfdf.length; i++) {
        console.log(xfdf[i]);
        let fdfDoc = await PDFNet.FDFDoc.createFromXFDF(xfdf[i]);
        await doc.fdfMerge(fdfDoc);
        await doc.flattenAnnotations();
    }
  
    const docbuf = await doc.saveMemoryBuffer(
      PDFNet.SDFDoc.SaveOptions.e_linearized,
    );
    const blob = new Blob([docbuf], {
      type: 'application/pdf',
    });
    uploadBytesToChild(docRef, blob)
  }

  await PDFNet.runWithCleanup(main);
};
