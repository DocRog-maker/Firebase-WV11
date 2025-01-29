import { getURL, uploadBytesToChild } from '../../firebase/firebase';

export const mergeAnnotations = async (Core, PDFNet, docRef, xfdf) => {
  Core.setWorkerPath('./webviewer/core');
  const URL = await getURL(docRef)

  const main = async () => {
    const doc = await PDFNet.PDFDoc.createFromURL(URL);
    doc.initSecurityHandler();
    let i;
    for (i = 0; i < xfdf.length; i++) {
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

    await uploadBytesToChild(docRef, blob)
  }

  await PDFNet.runWithCleanup(main).catch(function (error) {
    console.log('Error: ' + JSON.stringify(error));
  })
};
