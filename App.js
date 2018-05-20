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
  _buildDisplayGridRecords: function(snapshots) {
    console.log(snapshots);
    //snapshots is an array of arrays of snapshot results, one per snapshot date
    //debugger;
    var snapshotdates = this._getSnapshotdates(this.getContext().getTimeboxScope().getRecord());
    
    // var summarygridrecords = [{label:'added'},{label:'removed'},{label:'changed'},{label:'unchanged'}];
    // snapshotdates.forEach(function(element){
    //   summarygridrecord.added
    // });

    var gridrecords = [];
    for (var i = 0; i < snapshots.length; i++ ) {
      //debugger;
      //console.log(i);
      //console.log(snapshots[i]);
      for (var n = 0; n < snapshots[i].length; n++){
        //find  by FeatureID
        var snapshotrec = snapshots[i][n];
        var foundrec = gridrecords.find(function (element) {
          return (element.FormattedID === snapshotrec.get('FormattedID'));
        });
        if (foundrec === undefined){
          //add it
          var newgridrec = {};
          newgridrec.FormattedID = snapshotrec.get('FormattedID');
          newgridrec.Name = snapshotrec.get('Name');
          newgridrec.Project = snapshotrec.get('Project').Name;
          for (var j = 0; j < snapshotdates.length; j++){
            newgridrec[snapshotdates[j]] = null;
          }
          //snapshot store filter item 3 is '__At' date
          newgridrec[snapshotrec.store.getFilters().items[3].value] = snapshotrec.get('LeafStoryPlanEstimateTotal');
          newgridrec.firstVal =  snapshotrec.get('LeafStoryPlanEstimateTotal');
          newgridrec.changeVal = 0;
          gridrecords.push(newgridrec);
        } else {
          foundrec[snapshotrec.store.getFilters().items[3].value] = snapshotrec.get('LeafStoryPlanEstimateTotal');
          foundrec.changeVal = snapshotrec.get('LeafStoryPlanEstimateTotal') - foundrec.firstVal;
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
      if (gridrec[snapshotdates[0]] === null) {
        gridrec.Note = 'added';
      } else if (gridrec[snapshotdates[snapshotdates.length-1]] === null) {
        gridrec.Note = 'removed';
      } else if (gridrec.changeVal !== 0) {
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
        summaryType: 'sum'
      });
    }
    columns.push({
      text: 'Plan Est Total Chg',
      dataIndex: 'changeVal',
      summaryType: 'sum'
    });
    columns.push({
      text: 'Note',
      dataIndex: 'Note'
    });

    this._myGrid = Ext.create('Rally.ui.grid.Grid', {
      xtype: 'rallygrid',
      showRowActionsColumn: false,
      store: Ext.create('Rally.data.custom.Store', {
        data: gridrecords,
        sorters: [{
          property: 'changeVal',
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
  }
});
