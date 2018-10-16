Ext.define('CustomApp', {
  //extend: 'Rally.app.App',
  extend: 'Rally.app.TimeboxScopedApp',
  scopeType: 'release',
  comboboxConfig: {
    fieldLabel: 'Select an release:</div>',
    width: 400
  },
  componentCls: 'app',
  onScopeChange: function(timeboxscope) {
    //debugger;
    var release = timeboxscope.getRecord();
    var timeboxstore = Ext.create('Rally.data.wsapi.Store', {
     model: 'Release',
     filters: [{
       property: 'Name',
       operator: '=',
       value: release.get('Name')
     }],
     context: this.getContext().getDataContext(),
     fetch: ['ObjectID'],
     autoload: false,
    });
    timeboxstore.load().then({
      success: function(releases) {
        //debugger;
        var relScopeOIDs = this._getReleaseScopeOIDs(releases);
        var snapshotdates = this._getSnapshotdates(this.getContext().getTimeboxScope().getRecord());
        var loadfunctions = [];
        for (var i = 0; i < snapshotdates.length; i++ ) {
          var snapshotStore = this._createRelSnapshotStoreAtDate(
            relScopeOIDs,
            snapshotdates[i]
          );
          loadfunctions.push(snapshotStore.load());
        }

        Deft.Promise.all(loadfunctions).then({
          success: function(results){
            //debugger;
            //console.log(results);
            var gridrecords = this._buildDisplayGridRecords(results);
            //console.log(gridrecords);
            this._displayxgrid(gridrecords);
          },
          failure: function(){
            //do something
          },
          scope: this
        });
     },
     failure: function() {
       //do something
     },
     scope: this
    });
  },
  _getReleaseScopeOIDs: function (releases) {
    var oids = [];
    _.each(releases, function(release){
      oids.push(release.get('ObjectID'));
    });
    return oids;
  },
  _getSnapshotdates: function(release) {
    //debugger;
    var atDates = [];
    //use start of pi date for first snapshot
    atDates.push(release.get('formattedStartDate'));
    //loop adding two weeks to start date until > now or PI end date
    var dstart = new Date(release.get('formattedStartDate'));
    var dend = new Date(release.get('formattedEndDate'));
    var dnow = new Date();
    var dnext = Rally.util.DateTime.add(dstart, "day", 14);
    while(
      (Rally.util.DateTime.getDifference(dend, dnext,'day') > 0) &&
      (Rally.util.DateTime.getDifference(dnow, dnext,'day') > 0)
    ) {
      atDates.push(Rally.util.DateTime.format(dnext, "Y-m-d"));
      dnext = Rally.util.DateTime.add(dnext, "day", 14);
    }

    //last snapshot date either end of PI or current date
    if (Rally.util.DateTime.getDifference(dnow, dend,'day') > 0) {
      //now > rel end date, past the pi end Date
      //use pi end date for snapshot
      atDates.push(release.get('formattedEndDate'));
    } else {
      //PI end date in the future
      //use current Date for snapshot
      atDates.push('current');
    }
    return atDates;
  },
  _createRelSnapshotStoreAtDate:function(relScopeOIDs, atDate){
    var snapshotfilters = [];
    snapshotfilters.push({
      property: '_ProjectHierarchy',
      value: this.getContext().getProject().ObjectID
    });
    snapshotfilters.push({
      property: '_TypeHierarchy',
      value: 'PortfolioItem/Feature'
    });
    snapshotfilters.push({
      property: 'Release',
      operator: '$in',
      value: relScopeOIDs
    });
    snapshotfilters.push({
      id: '__At',
      property: '__At',
      value: atDate
    });
    return Ext.create('Rally.data.lookback.SnapshotStore', {
      compress: true,
      context: this.getContext().getDataContext(),
      fetch: ['FormattedID',
        'Name',
        'c_ServiceNowID',
        'Release',
        'Project',
        'LeafStoryCount',
        'LeafStoryPlanEstimateTotal'
      ],
      hydrate: ['Project'],
      sorters: [{
        property: 'FormattedID',
        direction: 'ASC'
      }],
      filters: snapshotfilters,
      removeUnauthorizedSnapshots: true
    });
  },
  _buildDisplayGridRecords: function(loadresults) {
    console.log(loadresults);
    //loadresults is the return of all the store load function calls
    //it is an array, with each element an array of snapshot models from a store load() with a specific __At date filter
    var snapshotdates = this._getSnapshotdates(this.getContext().getTimeboxScope().getRecord());
    //var sumrecs = this._createSumgridrecs(snapshotdates);
    var gridrecords = []; //array, each element a row in the grid display

    //loop over each snapshot store load result
    for (var i = 0; i < loadresults.length; i++ ) {
      var count, added, removed, changed, unchanged = 0; //some counters to keep track of features added/removed/change at each snapshot date

      //get the snapshot store filter __At date
      var store = loadresults[i][0].store;
      var atDate = store.getFilters().items[3].value; //snapshot store filter item 3 is '__At' date
      count = loadresults[i].length; //set summary record count, equal to # of features in release at snapshot date

      //loop over each snapshot model updating display grid records appropriately
      for (var n = 0; n < loadresults[i].length; n++){
        var snapshot = loadresults[i][n];
        //var snapshotdate = snapshot.store.getFilters().items[3].value; //snapshot store filter item 3 is '__At' date
        //see if feature exists already gridrecords by FeatureID
        var gridrec = gridrecords.find(function (element) {
          return (element.FormattedID === snapshot.get('FormattedID'));
        });
        if (gridrec === undefined){
          //add new record to gridrecords
          var newgridrec = {};
          newgridrec.FormattedID = snapshot.get('FormattedID');
          newgridrec.Name = snapshot.get('Name');
          newgridrec.Demand = snapshot.get('c_ServiceNowID');
          newgridrec.Project = snapshot.get('Project').Name;
          
          //newgridrec.LeafStoryCounts = {};
          //newgridrec.LeafStoryPlanEstimateTotals = {};

          for (var j = 0; j < snapshotdates.length; j++){
            //newgridrec[snapshotdates[j]] = null;
            newgridrec[snapshotdates[j]] = {};
            newgridrec[snapshotdates[j]].LeafStoryPlanEstimateTotal = null;
            newgridrec[snapshotdates[j]].LeafStoryCount = null;
  
            //newgridrec.LeafStoryCounts[snapshotdates[j]] = null;
            //newgridrec.LeafStoryPlanEstimateTotals[snapshotdates[j]] = null;
          }
          
          //newgridrec[atDate] = snapshot.get('LeafStoryPlanEstimateTotal');
          newgridrec[atDate].LeafStoryPlanEstimateTotal = snapshot.get('LeafStoryPlanEstimateTotal');
          newgridrec[atDate].LeafStoryCount = snapshot.get('LeafStoryCount');

          //newgridrec.LeafStoryCounts[atDate] = snapshot.get('LeafStoryCount');
          //newgridrec.LeafStoryPlanEstimateTotals[atDate] = snapshot.get('LeafStoryPlanEstimateTotal');
          
          newgridrec.planEst0 = snapshot.get('LeafStoryPlanEstimateTotal');
          newgridrec.planEstDiff = 0;

          newgridrec.count0 = snapshot.get('LeafStoryCount');
          newgridrec.countDiff = 0;
          
          gridrecords.push(newgridrec);
          if (i > 0) { //not the first set of snapshot records, i.e. after start of PI date
            //increment the added counter
            //sumrecs[0][atDate]++; //added counter
            added++;
          }
        } else {
          //update existing gridrecord with snapshot data
          //gridrec[atDate] = snapshot.get('LeafStoryPlanEstimateTotal');
          gridrec[atDate].LeafStoryPlanEstimateTotal = snapshot.get('LeafStoryPlanEstimateTotal');
          gridrec[atDate].LeafStoryCount = snapshot.get('LeafStoryCount');

          //gridrec.LeafStoryCounts[atDate] = snapshot.get('LeafStoryCount');
          //gridrec.LeafStoryPlanEstimateTotals[atDate] = snapshot.get('LeafStoryPlanEstimateTotal');

          gridrec.planEstDiff = snapshot.get('LeafStoryPlanEstimateTotal') - gridrec.planEst0;
          gridrec.countDiff = snapshot.get('LeafStoryCount') - gridrec.count0;
          
          //sumrecs[2][atDate]++; //changed counter
          if (gridrec.planEstDiff !== 0 || gridrec.countDiff !== 0) { //plan est total or US count value changed
            changed++;
          }

        }
        if (i>0) { //not the first snapshot date
          //feature count at this snapshot date = prevcount + any added - any removed
          var prevcount = loadresults[i-1].length; //current loadresults index - 1
          var currcount = loadresults[i].length; //count of feature loadresults in current array
          // var added = sumrecs[0][atDate]++; //counter been updating for this snapshot date when adding new recs
          var removed = currcount - prevcount - added;
          // if (removed > 0) {
          //   //set the summary record field
          //   sumrecs[1][atDate] = removed;
          // }
        } 
      }
    }

    // set the display grid comment
    //added: added to release after start of PI
    //removed: removed from release after start of PI
    //changed: in PI at start and end, but plan est total changed
    //unchanged: in PI at start and end, plan est total unchanged
    for (i = 0; i < gridrecords.length; i++ ) {
      var gridrec = gridrecords[i];
      // if (gridrec[snapshotdates[0]] === null) {
      if (gridrec[snapshotdates[0]].LeafStoryPlanEstimateTotal === null) {
        gridrec.Note = 'added';
      //} else if (gridrec[snapshotdates[snapshotdates.length-1]] === null) {
      } else if (gridrec[snapshotdates[snapshotdates.length-1]].LeafStoryPlanEstimateTotal === null) {
        gridrec.Note = 'removed';
      } else if (gridrec.planEstDiff !== 0) {
        gridrec.Note = 'changed';
      } else {
        gridrec.Note = 'unchanged';
      }
    }

    console.log(gridrecords);
    return gridrecords;
  },
  _displayxgrid: function(gridrecords) {
    debugger;
    if (this._myGrid) {
        this._myGrid.destroy();
    }
    var columns = [{
      text: 'ID',
      dataIndex: 'FormattedID'
      },{
        text: 'Name',
        dataIndex: 'Name',
        width: 400
      },{
        text: 'Demand',
        dataIndex: 'Demand',
        width: 150
      },{
        text: 'Project',
        dataIndex: 'Project',
        width: 150
      }
    ];
    var snapshotdates = this._getSnapshotdates(this.getContext().getTimeboxScope().getRecord());
    for (var i = 0; i < snapshotdates.length; i++){
      columns.push({
        text: snapshotdates[i],
        dataIndex: snapshotdates[i],
        //summaryType: 'sum',
        renderer: function(value) {
          return value.LeafStoryCount + ' / ' + value.LeafStoryPlanEstimateTotal;
        }
      });
    }

    columns.push({
      text: 'Story count change',
      dataIndex: 'countDiff',
      summaryType: 'sum'
    });

    columns.push({
      text: 'Plan Est Total change',
      dataIndex: 'planEstDiff',
      summaryType: 'sum'
    });

    columns.push({
      text: 'Note',
      dataIndex: 'Note'
    });

    this._myGrid = Ext.create('Rally.ui.grid.Grid', {
      // xtype: 'rallygrid',
      xtype: 'rallygridboard',
      showRowActionsColumn: false,
      store: Ext.create('Rally.data.custom.Store', {
        data: gridrecords,
        sorters: [{
          property: 'planEstDiff',
          direction: 'DESC'
        }]
      }),
      columnCfgs: columns,
      title: 'Release features Plan estimate total changes over time',
      features: [{
        ftype: 'summary'
      }]
    });
    this.add(this._myGrid);
  },
  _createSumgridrecs: function(dates){
    var sumrecs = [];
    var counters = ['added','removed','changed','unchanged','count'];
    for (var c =0; c < counters.length; c++ ) {
      var newrec = {};
      newrec.label = counters[c];
      for (var d = 0; d < dates.length; d++) {
        newrec[dates[d]] = 0;
      }
      counters.push(newrec);
    }
    return records;
  },
  _createGridColumns: function(gridrecords) {
    var columns = [{
      text: 'ID',
      dataIndex: 'FormattedID'
      },{
        text: 'Name',
        dataIndex: 'Name',
        width: 400
      },{
        text: 'Demand',
        dataIndex: 'Demand',
        width: 150
      },{
        text: 'Project',
        dataIndex: 'Project',
        width: 150
      }
    ];
    
    var snapshotdates = this._getSnapshotdates(this.getContext().getTimeboxScope().getRecord());
    
    for (var i = 0; i < snapshotdates.length; i++) {
      columns.push({
        text: snapshotdates[i],
        dataIndex: snapshotdates[i],
        summaryType: 'sum'
      });
    }
    
    columns.push({
      text: 'LeafStoryPlanEstimateTotal change',
      dataIndex: 'planEstDiff',
      summaryType: 'sum'
    });
    
    columns.push({
      text: 'Note',
      dataIndex: 'Note'
    });

    return columns;
  }
});
