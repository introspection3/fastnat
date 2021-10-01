 async function name(params) {

     const upnp = require('upnpjs');

     const igd = await upnp.discover();

     const ip = await igd.getExternalIPAddress();

     await igd.addPortMapping({
         ip: ip,
         internalPort: 54321,
         externalPort: 54321,
         protocol: 'TCP', // Defaults to TCP
         description: 'Example port map from 54321 -> 54321', // Defaults to empty string
         enabled: false // Defaults to true
     });
     console.log('end')
 }
 name();