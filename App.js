Ext.define('CustomApp', {
  //extend: 'Rally.app.App',
  extend: 'Rally.app.TimeboxScopedApp',
  scopeType: 'release',
  comboboxConfig: {
    fieldLabel: 'Select an release:</div>',
    width: 400
  },
  componentCls: 'app',
  onTimeboxScopeChange: function() {
    var timeboxstore = Ext.create('Rally.data.wsapi.Store', {
     model: 'Release',
     filters: [{
       property: 'Name',
       operator: '=',
       value: this.getContext().getTimeboxScope().getRecord().get('Name')
     }],
     context: this.getContext().getDataContext(),
     fetch: ['ObjectID'],
     autoload: false,
    });
    timeboxstore.load().then({
      success: function(data) {
        var oids = [];
        _.each(data, function(timeboxrec){
          oids.push(timeboxrec.get('ObjectID'));
        });
        //debugger;
        var snapshotfilters = [];
        var timeboxScope = this.getContext().getTimeboxScope();
        var timeboxRec = timeboxScope.getRecord();

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
          value: oids
        });
        snapshotfilters.push({
          id: '__At',
          property: '__At',
          value: timeboxRec.get('formattedStartDate')
        });
        var snapshot1Store = Ext.create('Rally.data.lookback.SnapshotStore', {
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
          sorters: [
          {
            property: 'FormattedID',
            direction: 'ASC'
          }],
          filters: snapshotfilters,
          removeUnauthorizedSnapshots: true
        });
        var snapshot2Store = Ext.create('Rally.data.lookback.SnapshotStore', {
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
          sorters: [
          {
            property: 'FormattedID',
            direction: 'ASC'
          }],
          filters: snapshotfilters,
          removeUnauthorizedSnapshots: true
        });
        snapshot2Store.removeFilter('__At', false);
        snapshot2Store.addFilter({
          id: '__At',
          property: '__At',
          value: 'current'
        },false);

        Deft.Promise.all([snapshot1Store.load(),snapshot2Store.load()]).then({
          success: function(results){
            //debugger;
            console.log(results);
              snapshot1records = results[0];
              snapshot2records = results[1];
              var gridrecords = [];
              //iterate over  snapshot1 records
              //create a custom grid record for each
              _.each(snapshot1records, function(snapshot1rec){
                grid_rec = new Object();
                grid_rec.FormattedID = snapshot1rec.get('FormattedID');
                grid_rec.Name = snapshot1rec.get('Name');
                grid_rec.Project = snapshot1rec.get('Project').Name;
                grid_rec.LeafStoryCount1 = snapshot1rec.get('LeafStoryCount');
                grid_rec.LeafStoryCount2 = -1;
                grid_rec.LeafStoryPlanEstimateTotal1 = snapshot1rec.get('LeafStoryPlanEstimateTotal');
                grid_rec.LeafStoryPlanEstimateTotal2 = -1;
                grid_rec.LeafStoryCountChg = -1;
                grid_rec.LeafStoryCountPercentChg = -1;
                grid_rec.LeafStoryPlanEstimateTotalChg = -1;
                grid_rec.LeafStoryPlanEstimateTotalPercentChg = -1;
                grid_rec.Comment = '';
                gridrecords.push(grid_rec);
              });
              console.log(gridrecords);
              //iterate over snapshot2 records, matching and updating
              //ones that exist from snapshot1, adding new ones only in
              //snapshot2
              _.each(snapshot2records, function(snapshot2rec){
                //find  by FeatureID
                var foundrec = gridrecords.find(function (gridrec) {
                  return (gridrec.FormattedID === snapshot2rec.get('FormattedID'));
                });
                if (foundrec === undefined){
                  //not in first snapshot rec set
                  //add it
                  grid_rec = new Object();
                  grid_rec.FormattedID = snapshot2rec.get('FormattedID');
                  grid_rec.Name = snapshot2rec.get('Name');
                  grid_rec.Project = snapshot2rec.get('Project').Name;
                  grid_rec.LeafStoryCount1 = 0;
                  grid_rec.LeafStoryPlanEstimateTotal1 = 0;
                  grid_rec.LeafStoryCount2 = snapshot2rec.get('LeafStoryCount');
                  grid_rec.LeafStoryPlanEstimateTotal2 = snapshot2rec.get('LeafStoryPlanEstimateTotal');
                  grid_rec.LeafStoryCountChg = grid_rec.LeafStoryCount2;
                  grid_rec.LeafStoryCountPercentChg = 'n/a';
                  grid_rec.LeafStoryPlanEstimateTotalChg = grid_rec.LeafStoryPlanEstimateTotal2;
                  grid_rec.LeafStoryPlanEstimateTotalPercentChg = 'n/a';
                  grid_rec.Comment = 'added after start of PI';
                  gridrecords.push(grid_rec);
                } else {
                  //populate the snapshot2 values
                    foundrec.LeafStoryCount2 = snapshot2rec.get('LeafStoryCount');
                    foundrec.LeafStoryPlanEstimateTotal2 = snapshot2rec.get('LeafStoryPlanEstimateTotal');
                    foundrec.LeafStoryCountChg = foundrec.LeafStoryCount2 - foundrec.LeafStoryCount1;
                    foundrec.LeafStoryCountPercentChg = (foundrec.LeafStoryCountChg /foundrec.LeafStoryCount1).toFixed(2) * 100;
                    foundrec.LeafStoryPlanEstimateTotalChg = foundrec.LeafStoryPlanEstimateTotal2 - foundrec.LeafStoryPlanEstimateTotal1;
                    foundrec.LeafStoryPlanEstimateTotalPercentChg = ((foundrec.LeafStoryPlanEstimateTotalChg / foundrec.LeafStoryPlanEstimateTotal1)* 100).toFixed(2);
                }
              });
              gridrecords.forEach(function(grid_rec){
                if(grid_rec.LeafStoryCount2 == -1 && grid_rec.LeafStoryPlanEstimateTotal2 == -1) {
                  grid_rec.Comment = 'removed after start of PI';
                }
                if(grid_rec.LeafStoryCount1 == 0 ) {
                  //divide by zero undefined
                  grid_rec.LeafStoryCountPercentChg = '';
                }
                if(grid_rec.LeafStoryPlanEstimateTotal1 == 0) {
                  //divide by zero undefined
                  grid_rec.LeafStoryPlanEstimateTotalPercentChg = '';
                }
              });
              console.log(gridrecords);
              if (this._myGrid) {
                  this._myGrid.destroy();
              }
              this._myGrid = Ext.create('Rally.ui.grid.Grid', {
                xtype: 'rallygrid',
                store: Ext.create('Rally.data.custom.Store', {
                  data: gridrecords,
                  sorters: [{
                    property: 'LeafStoryPlanEstimateTotalChg',
                    direction: 'DESC'
                  }]
                }),
                columnCfgs: [{
                  text: 'ID',
                  dataIndex: 'FormattedID'
                },{
                  text: 'Name',
                  dataIndex: 'Name'
                },{
                  text: 'Project',
                  dataIndex: 'Project'
                },{
                  text: 'Story Count',
                  dataIndex: 'LeafStoryCount1'
                },{
                  text: 'Story Plan Est Total',
                  dataIndex: 'LeafStoryPlanEstimateTotal1'
                },{
                  text: 'Story Count 2',
                  dataIndex: 'LeafStoryCount2'
                },{
                  text: 'Story Plan Est Total 2',
                  dataIndex: 'LeafStoryPlanEstimateTotal2'
                },{
                  text: 'Story count chg',
                  dataIndex: 'LeafStoryCountChg'
                },{
                  text: 'Story Plan Est Chg',
                  dataIndex: 'LeafStoryPlanEstimateTotalChg'
                },{
                  text: 'Story Count % Chg',
                  dataIndex: 'LeafStoryCountPercentChg',
                },{
                  text: 'Story Plan Est % Chg',
                  dataIndex: 'LeafStoryPlanEstimateTotalPercentChg'
                },{
                  text: 'Comment',
                  dataIndex: 'Comment'
                }]
              });
              this.add(this._myGrid);
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
  _buildgridrecords: function(records) {
    return gridrecords;
  },
  _createsnapshot1store:function(){

  },
  _createsnapshot2store:function(){

  },
  _loadsnapshot1: function() {

  },
  _loadsnapshot2: function () {

  }

});
