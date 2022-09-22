const mapModule = (()=>{      
        let _config = {
          mapbox_keys: {            
            all: {pk: 'pk.eyJ1IjoiY29uY3VyaWEiLCJhIjoiY2ttMmljdTB3MDlqNDJybnI0NmwzY29qNiJ9.vs1MjerbcI6oC7jNFmPcEQ', dataset: 'cl846sjkg0o0r28pk5f2b9jul', user: 'concuria', style: 'mapbox://styles/concuria/cl80cw1mo000a15pkcna3303l'},
            sbat: {
              pk: 'pk.eyJ1IjoiY29uY3VyaWEtYnYiLCJhIjoiY2w4NDc3bW1oMDA2OTNwcDVnYWQ5MHY2dSJ9.9jXhkxKbQ0nTHkvIAzsbHw', 
              dataset: 'cl8486g6008lu27lawf8y3jy7', 
              user: 'concuria-bv', 
              style: 'mapbox://styles/concuria-bv/cl84gtt4q00f914pm3qc6r2j2'
            },
            aibv: {pk: 'pk.eyJ1IjoiY29uY3VyaWEiLCJhIjoiY2ttMmljdTB3MDlqNDJybnI0NmwzY29qNiJ9.vs1MjerbcI6oC7jNFmPcEQ', dataset: 'cl846sjkg0o0r28pk5f2b9jul', user: 'concuria', style: 'mapbox://styles/concuria/cl80cw1mo000a15pkcna3303l'},
            km: {pk: 'pk.eyJ1IjoiY29uY3VyaWEiLCJhIjoiY2ttMmljdTB3MDlqNDJybnI0NmwzY29qNiJ9.vs1MjerbcI6oC7jNFmPcEQ', dataset: 'cl846sjkg0o0r28pk5f2b9jul', user: 'concuria', style: 'mapbox://styles/concuria/cl80cw1mo000a15pkcna3303l'},
            autoveiligheid: {pk: 'pk.eyJ1IjoiY29uY3VyaWEiLCJhIjoiY2ttMmljdTB3MDlqNDJybnI0NmwzY29qNiJ9.vs1MjerbcI6oC7jNFmPcEQ', dataset: 'cl846sjkg0o0r28pk5f2b9jul', user: 'concuria', style: 'mapbox://styles/concuria/cl80cw1mo000a15pkcna3303l'}
          },
          popup_templates: {
            aibv: document.querySelector('#tpl-aibv-popup'),
            km: document.querySelector('#tpl-km-popup'),
            autoveiligheid: document.querySelector('#tpl-autoveiligheid-popup'),
            sbat: document.querySelector('#tpl-sbat-popup')
          },
          associations: ['sbat', 'aibv', 'km', 'autoveiligheid'],
          holidays: {},
          airtables: {
            SBAT: 'appYDN0aUSA61rzMi/tblyIhsNuDrVlDPnL',
            AIBV: 'apphJQRHotvSdaL9H/tblROkjkYemHxm1Ka',
            KM: 'appD5jyiWwolhsdFP/tbldaN0VwhfaBEtgi',
            AUTOVEILIGHEID: 'appWotVCqBrThRNj7/tblwtXnf0miIB33UA',
            holidays: 'appKSKHfNUmwBARVh/tbleFXzNr9aqMpWUm'
          },
          airtable_readonly_apikey: 'keyAeKhTcgTZaIPY2',
          apiRequestTemplate: `https://api.airtable.com/v0/{{tableInfo}}?api_key={{api_key}}`,
          mapboxDatasetRequestTemplate: `https://api.mapbox.com/datasets/v1/{{user_name}}/{{dataset_name}}/features?access_token={{token}}`,
          status: 'default',
          selected_association: null,
          selected_dataset_id: null,
          selected_token: null,
          selected_user: null,
          update_treshold_seconds: 14400
        }
        let _assets = {}
        let _domAssets = {}

        /**
         * Summary.
         *
         * Prior to initialization, check the URL for relevant parameters and select the matching information
         * (mapbox public key, station dataset ID) from the pre-set options representing different associations
         * 
         * Description.
         *
         * @access     private
         * @alias    _preInit
         * @memberof mapModule
         * 
         */

        function _preInit() {
          let associations = Object.keys(_config.mapbox_keys).map(element => {
              return element.toLowerCase();
          })
          let association = _readAssociationFromURL()
          
          if(typeof _config.mapbox_keys[association] == 'undefined') {
            mapboxgl.accessToken = _config.mapbox_keys['all'].pk
            _config.selected_token = _config.mapbox_keys['all'].pk
            _config.selected_user = _config.mapbox_keys['all'].user
            _config.selected_dataset_id = _config.mapbox_keys['all'].dataset
            _config.selected_association = 'all'
            _config.selected_mapstyle = _config.mapbox_keys['all'].style
          }
          else
          {
            mapboxgl.accessToken = _config.mapbox_keys[association].pk
            _config.selected_token = _config.mapbox_keys[association].pk
            _config.selected_user = _config.mapbox_keys[association].user
            _config.selected_dataset_id = _config.mapbox_keys[association].dataset
            _config.selected_association = association
            _config.selected_mapstyle = _config.mapbox_keys[association].style
          }
        }

        /**
         * Summary.
         *
         * Initializes the map object using he information passed in as the argument
         * 
         * Description.
         *
         * @access     private
         * @alias    _init
         * @memberof mapModule
         *
         * @mapAttrs {Object}  Object literal containing information necessary for map initialization
         * 
         */

        function _init(mapAttrs) {
          _preInit()
          mapAttrs.style = _config.selected_mapstyle
          _assets.map = new mapboxgl.Map(mapAttrs)
          _assets.popup = new mapboxgl.Popup({
            offset: [0, -20]
          })
          _prepareData().then(_onLoadHandler)          
        }

        /**
         * Summary.
         *
         * Prepare the data from Airtable and Mapbox Dataset and rub them together into one geoJSON file
         * suitable for rendering a layer
         * 
         * Description.
         *
         * @access     private
         * @alias    _prepareData
         * @memberof mapModule
         * 
         */        

        function _prepareData() {
          let datasetPromise = _loadStationsDataset().then((data)=>{
            return data.json()
          })        
          return Promise.all([datasetPromise, _getAirtableData()]).then((data)=>{
            let holidayListData = null
            if(data[1].length == 2){
              holidayListData = data[1][1].records.slice(0)
            }
            else if(data[1].length == 5) {
              holidayListData = data[1][4].records.slice(0)
            }
            
            holidayListData.forEach((holiday, index)=>{              
              _config.holidays[holiday.fields['Date']] = holiday.fields['Name']
            })

            let stationData = _formatAirtableData(data[1])
            let stationGeoData = data[0]

            let station_ids = stationData.map((station) => {
              return station.stationID
            })

            let geojson = {type: 'FeatureCollection', features: []}
            for(let h = 0; h < stationGeoData.features.length; h++) {
              if(station_ids.indexOf(parseInt(stationGeoData.features[h].properties.station_id)) > -1){
                geojson.features.push(stationGeoData.features[h])
              }
            }

            for(let i = 0; i < stationData.length; i++) {
              for(let h = 0; h < geojson.features.length; h++) {
                if(parseInt(geojson.features[h].properties.station_id) == parseInt(stationData[i].stationID)){
                  if(station_ids.indexOf(parseInt(stationData[i].stationID)) > -1){
                    geojson.features[h].properties = JSON.parse(JSON.stringify(stationData[i]))
                  }
                  break
                }
              }              
            }

            return geojson
          })
        }

        /**
         * Summary.
         *
         * Grab the URL and parse it for the association parameter
         * Return the default 'all' value both if the association parameter is empty and
         * if the association parameter is absent
         * 
         * Description.
         *
         * @access     private
         * @alias    _readAssociationFromURL
         * @memberof mapModule
         * 
         */        

        function _readAssociationFromURL() { 
            const urlParams = new URLSearchParams(window.location.search)
            if(urlParams.has('association')) {
              if(urlParams.get('association') == '') {
                return 'all'
              }
              else
              {
                let association = urlParams.get('association').toLowerCase()
                return association
              }
            }
            else
            {
              return 'all'
            }
        }

        /**
         * Summary.
         *
         * Return a promise using the HTML5 fetch API, that when fulfilled returns the station geodataset using the Mapbox Dataset API
         * 
         * Description.
         *
         * @access     private
         * @alias    _loadStationsDataset
         * @memberof mapModule
         * 
         */ 

        function _loadStationsDataset() {
          return fetch(_config.mapboxDatasetRequestTemplate.replace('{{user_name}}', _config.selected_user).replace('{{dataset_name}}',_config.selected_dataset_id).replace('{{token}}', _config.selected_token))
        }

        /**
         * Summary.
         *
         * To be performed as soon as the map object finished loading it's resources and it is done painting the map
         * It includes adding a Mapbox GL source using the combined GeoJSON generated from the Mapbox Dataset data and the Airtables,
         * as well as creating a layer for the stations. And finally events are added to the layer.
         * 
         * Description.
         *
         * @access     private
         * @alias    _onLoadHandler
         * @memberof mapModule
         * 
         * @geojson {Object}  A valid geojson object literal (FeatureCollection) containing all station items with their geometries and full data
         * 
         */ 

        function _onLoadHandler(geojson = undefined) {
          _config.status = 'loaded'

          if( typeof geojson != 'undefined' ) {
            _assets.map.addSource('stations-src', {type: 'geojson', data: geojson})
          }
          else
          {
            alert('No data is available for display.')
            return
          }

          _assets.map.addLayer({
            id: 'stations-lyr',
            type: 'symbol',
            source: 'stations-src',         
            paint: {
              'text-opacity': ["step", ["zoom"], 0, 9.5, 1],
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2
            },   
            layout: {
              'text-field': ["get", "name"],              
              'text-offset': [0,-2],
              'icon-image': ["case",
                ["==", ["get", "holiday"], ["to-boolean", true]], "no-status",
                ["==", ["to-number", ["get", "busyness"]], 0], ["case", ["!", ["get", "open_now"]], "no-status", "appointment-only"],
                ["!", ["get", "open_now"]], "no-status",
                ["!", ["get", "up_to_date"]], "not-current",                
                ["==", ["to-number", ["get", "busyness"]], 1], "busy-1",
                ["==", ["to-number", ["get", "busyness"]], 2], "busy-2",
                ["==", ["to-number", ["get", "busyness"]], 3], "busy-3",
                ["==", ["to-number", ["get", "busyness"]], 4], "busy-4",                
                
                
                "no-status"
              ],
              'icon-size': 0.5,
              'icon-allow-overlap': true,
              'text-allow-overlap': true
            }
          })

          _fitMapToGeojson(geojson) 
          
          _addEvents()
        }

        /**
         * Summary.
         *
         * Fit the map the supplied geojson object's geographical extent
         * 
         * Description.
         *
         * @access     private
         * @alias    _fitMapToGeojson
         * @memberof mapModule
         * 
         * @geojson {Object}  A valid geojson object literal (FeatureCollection) containing all station items with their geometries and full data
         * 
         */ 

        function _fitMapToGeojson(geojson) {
          let bounds = new mapboxgl.LngLatBounds()
          geojson.features.forEach((feature)=>{
            bounds.extend(feature.geometry.coordinates)
          })         
          _assets.map.fitBounds(bounds, {padding: 50})
        }

        /**
         * Summary.
         *
         * Taking the association name as an input, retrieve all relevant airtables and return them as Promise objects
         * 
         * Description.
         *
         * @access     private
         * @alias    _createTablePromises
         * @memberof mapModule
         * 
         * @association {String}  String representation of the selected association (the association value passed in the URL)
         * 
         */ 

        function _createTablePromises(association = undefined) {
            let promises = []
            if(typeof association == 'undefined' || association == 'all') {
              for(let i in _config.airtables) {
                promises.push(fetch(_config.apiRequestTemplate.replace('{{tableInfo}}', _config.airtables[i]).replace('{{api_key}}', _config.airtable_readonly_apikey)))
              }
            }
            else
            {
              for(let i in _config.airtables) {
                if(i.toLowerCase() == _config.selected_association) {
                  promises.push(fetch(_config.apiRequestTemplate.replace('{{tableInfo}}', _config.airtables[i]).replace('{{api_key}}', _config.airtable_readonly_apikey)))
                }
              }
              promises.push(fetch(_config.apiRequestTemplate.replace('{{tableInfo}}', _config.airtables['holidays']).replace('{{api_key}}', _config.airtable_readonly_apikey)))             
            }
            return promises
        }

        /**
         * Summary.
         *
         * Fetch all the data from whatever number of Airtables and merge them together before returning the final results as a Promise
         * 
         * Description.
         *
         * @access     private
         * @alias    _getAirTableData
         * @memberof mapModule
         * 
         */ 

        function _getAirtableData() {
          
          return new Promise(function(resolve, reject){
            Promise.all(_createTablePromises(_config.selected_association))
            .then((responses)=>{
              let promises = []
              responses.forEach((responseObj)=>{
                promises.push(responseObj.json())
              })
              Promise.all(promises).then((data)=>{
                let stations = []
                data.forEach((dataSource, index)=>{
                  if(index <= 3){
                    dataSource.records.forEach((record)=>{
                      record.association = (_config.selected_association == "all") ? _config.associations[index] : _config.selected_association
                      stations.push(record)
                    })
                  }
                })
                resolve(data)
              })
            })
          })
        }
        
        /**
         * Summary.
         *
         * Turn multiple raw Airtable data into a single, meaningful array of stations
         * 
         * Description.
         *
         * @access     private
         * @alias    _formatAirtableData
         * @memberof mapModule
         * 
         * @incoming {Array}  Array of Airtable results
         * 
         */ 

        function _formatAirtableData(incoming) {
            let stations = []
            incoming.forEach((source)=>{
              source.records.forEach((record)=>{
                let now = Math.floor(new Date().getTime() / 1000)                

                let openingTimes = {
                  monday: _createTimeIntervals(now, record.fields['Monday open'], record.fields['Monday close'], record.fields['Start midday break'], record.fields['Stop midday break']),
                  tuesday: _createTimeIntervals(now, record.fields['Tuesday open'], record.fields['Tuesday close'], record.fields['Start midday break'], record.fields['Stop midday break']),
                  wednesday: _createTimeIntervals(now, record.fields['Wednesday open'], record.fields['Wednesday close'], record.fields['Start midday break'], record.fields['Stop midday break']),
                  thursday: _createTimeIntervals(now, record.fields['Thursday open'], record.fields['Thursday close'], record.fields['Start midday break'], record.fields['Stop midday break']),
                  friday: _createTimeIntervals(now, record.fields['Friday open'], record.fields['Friday close'], record.fields['Start midday break'], record.fields['Stop midday break'])
                }                
                let item = {
                    id: record.id,
                    association: record.association,
                    name: record.fields.Name,                    
                    busyness: (typeof record.fields.Busyness != 'undefined') ? parseInt(record.fields.Busyness) : 0,
                    stationID: parseInt(record.fields.Station),
                    last_updated: record.fields['Last update'],
                    up_to_date: ((now - _config.update_treshold_seconds) > Math.floor(new Date(record.fields['Last update']).getTime() / 1000)) ? false : true,
                    address: record.fields['Address'],
                    info_link: record.fields['Info link'],
                    appointment_link: record.fields['Appointment link'],
                    google_maps_link: record.fields['Google maps link']                    
                }

                for(let i in openingTimes){
                  if(i != new Date().toLocaleDateString('en-EN', {weekday: 'long'}).toLowerCase()) {
                      delete openingTimes[i]
                  }
                  else{
                    for(j in openingTimes[i]) {
                      item[j] = openingTimes[i][j]
                    }
                  }
                }
                stations.push(item)
              })
            })
            return stations
        }

        /**
         * Summary.
         *
         * Sorts stations to busyness categories based on their stationID- and busyness attribute
         * 
         * Description.
         *
         * @access     private
         * @alias    _createBusynessCategories
         * @memberof mapModule
         * 
         * @start {Object}  Object literal containing attributes of a station item
         */

        function _createBusynessCategories(stationsData) {
          let busyness = {1: [], 2: [], 3: [], 4: []}
          stationsData.forEach((station)=>{
            busyness[station.busyness].push(parseInt(station.stationID))
          })
        }

        /**
         * Summary.
         *
         * Creates object literals with all details regarding opening hours
         * such as start and end of opening hours in human readable format as well as UNIX epoch values
         * and an open_now boolean
         * 
         * Description.
         *
         * @access     private
         * @alias    __createTimeIntervals
         * @memberof mapModule
         * 
         * @start {String}  string representation of the start opening hour (07:00)
         * @end {String}  string representation of the end opening hour (19:00)
         */

        function _createTimeIntervals(now, start, end, midday_start, midday_end) {
            if(typeof start == 'undefined' || typeof end == 'undefined') {
                return {start: 0, start_human: null,  end: 0, end_human: null}
            }
            let dateStart = new Date()
            let dateEnd = new Date()
            let dateStartParts = start.split(':')
            let dateEndParts = end.split(':')
            
            dateStart.setHours(parseInt(dateStartParts[0]), parseInt(dateStartParts[1]), 0)
            dateEnd.setHours(parseInt(dateEndParts[0]), parseInt(dateEndParts[1]), 0)            
            
            let response = {
                start: Math.floor(dateStart.getTime() / 1000),
                start_human: start,
                end: Math.floor(dateEnd.getTime() / 1000),
                end_human: end,
                open_now: now > Math.floor(dateStart.getTime() / 1000) && now < Math.floor(dateEnd.getTime() / 1000)
            }

            if (typeof midday_start != 'undefined' && typeof midday_end != 'undefined') {
              let dateMiddayStart = new Date()
              let dateMiddayEnd = new Date()
              let dateMiddayStartParts = midday_start.split(':')
              let dateMiddayEndParts = midday_end.split(':')
              dateMiddayStart.setHours(parseInt(dateMiddayStartParts[0]), parseInt(dateMiddayStartParts[1]), 0)
              dateMiddayEnd.setHours(parseInt(dateMiddayEndParts[0]), parseInt(dateMiddayEndParts[1]), 0)
              response.midday_start = Math.floor(dateMiddayStart.getTime() / 1000)
              response.midday_start_human = midday_start
              response.midday_end = Math.floor(dateMiddayEnd.getTime() / 1000)
              response.midday_end_human = midday_end
              response.open_now = (now > Math.floor(dateStart.getTime() / 1000)) && (now < Math.floor(dateMiddayStart.getTime() / 1000)) 
              || ( (now < Math.floor(dateEnd.getTime() / 1000)) && (now > Math.floor(dateMiddayEnd.getTime() / 1000)) )              
            }

            let today = new Date()
            let today_formatted = `${today.getFullYear()}-${_padTo2Digits(today.getMonth() + 1)}-${_padTo2Digits(today.getDate())}`

            for(h in _config.holidays) {
              if(today_formatted === h){
                response.holiday = true
                break  
              }
            }

            return response
        }

        function _getStatus() {
          return _config.status
        }

        /**
         * Summary.
         *
         * Adds event listeners to the map layers, such as click, mouseenter and mouseleave
         * 
         * Description.
         *
         * @access     private
         * @alias    _addEvents
         * @memberof mapModule
         * 
         */

        function _addEvents() {
          _assets.map.on('click', 'stations-lyr', function(e) {
            let clickedProps = e.features[0].properties
            console.log(clickedProps)
            let popupContent = _config.popup_templates[e.features[0].properties.association].innerHTML
              .replace('{{google_maps_link}}', clickedProps.google_maps_link)
              .replace('{{info_link}}', clickedProps.info_link)
              .replace('{{appointment_link}}', clickedProps.appointment_link)
              .replace('{{name}}', clickedProps.name)
              .replace('{{address}}', clickedProps.address)
              .replace('{{last_update}}', _formatDate(new Date(clickedProps.last_updated)).slice(0, -3))
              .replace('{{start_human}}', clickedProps.start_human)
              .replace('{{end_human}}', clickedProps.end_human)
            _assets.popup
              .setLngLat(e.features[0].geometry.coordinates)
              .setHTML(popupContent)
              .addTo(_assets.map)            
          })

          _assets.map.on('mouseenter', 'stations-lyr', function() {
            _assets.map.getCanvas().style.cursor = 'pointer'
          })

          _assets.map.on('mouseleave', 'stations-lyr', function() {
            _assets.map.getCanvas().style.cursor = ''
          })          
        }

        /**
         * Summary.
         *
         * Utility function to turn a number to 2 digits only
         * used with date formatting functions
         * 
         * Description.
         *
         * @access     private
         * @alias    _padTo2Digits
         * @memberof mapModule
         * 
         */

        function _padTo2Digits(num) {
          return num.toString().padStart(2, '0')
        }
        
        /**
         * Summary.
         *
         * Utility function to return a date in YYYY-MM-DD format
         * useful if we don't want to use Moment.JS for very simple tasks
         * 
         * Description.
         *
         * @access     private
         * @alias    _formatDate
         * @memberof mapModule
         * 
         */
        
        function _formatDate(date) {
          return (
            [
              date.getFullYear(),
              _padTo2Digits(date.getMonth() + 1),
              _padTo2Digits(date.getDate()),
            ].join('-') +
            ' ' +
            [
              _padTo2Digits(date.getHours()),
              _padTo2Digits(date.getMinutes()),
              _padTo2Digits(date.getSeconds()),
            ].join(':')
          )
        }

        return {
          status: _getStatus,
          getData: _getAirtableData,  
          initialize: _init
        }
      })()

      mapModule.initialize({
        center: [4.55, 50.6],
        zoom: 7,
        container: 'goca-map'
      })
