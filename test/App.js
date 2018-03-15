Ext.define('CustomApp', {
  extend: 'Rally.app.App',
  componentCls: 'app',
  launch: function() {
    debugger;

    var app = this;
    var snapshotfilters = [];
    // var project = this.getContext().getProject();
    // var poid = project.ObjectID;
    // or poid = this.getContext().getProject().ObjectID in one call
    // var datacontext = this.getContext().getDataContext();
    // debugger;

    // _TypeHierarchy scope to artifact type
    snapshotfilters.push({
        property: '_TypeHierarchy',
        operator: '=',
        value: 'HierarchicalRequirement'
    });

    // FormattedID just get a single story, for debugging
    // snapshotfilters.push({
    //     property: 'FormattedID',
    //     operator: '=',
    //     value: 'US64950'
    // });

    // _PreviousValues include only snapshots where PlanEstimate changed & previous value > 0 (elminates original est value)
    // snapshotfilters.push({
    //     property: '_PreviousValues.PlanEstimate',
    //     value: {$exists: true}
    // });
    // snapshotfilters.push({
    //     property: '_PreviousValues.PlanEstimate',
    //     operator: '>',
    //     value: 0
    // });
    snapshotfilters.push({
        property: '_PreviousValues.Iteration',
        value: {$exists: true}
    });
    snapshotfilters.push({
        property: '_PreviousValues.Iteration',
        value: {$ne: null}
    });

    // _ValidFrom set to limit timeboxscope, >= sprint start and <= sprint end
    snapshotfilters.push({
      property: '_ValidFrom',
      operator: '>=',
      value: '2017-12-07TZ'
    });
    snapshotfilters.push({
      property: '_ValidFrom',
      operator: '<=',
      value: '2017-12-20TZ'
    });

    // _ValidTo if specifed will not include current snapshot, see __At and 'current'
    // current snapshot date is 9999-99-99TZ
    // snapshotfilters.push({
    //     property: '_ValidTo',
    //     operator: '<=',
    //     value: '2016-10-31TZ'
    // });

    // _ProjectHierarchy !! required to limit scope !!
    snapshotfilters.push({
        property: '_ProjectHierarchy',
        operator: '=',
        value: this.getContext().getProject().ObjectID
    });

    //create the store
    var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
        compress: true,
        context: this.getContext().getDataContext(),
        fetch: ['FormattedID', 'Name', 'PlanEstimate', 'Feature', 'Parent', 'Owner', 'Iteration','_PreviousValues.Iteration'],
        hydrate: ["Iteration", "_PreviousValues.Iteration", "Feature", 'Owner'],
        filters: snapshotfilters,
        groupField: 'Feature',
        groupDir: 'ASC',
        getGroupString: function(instance){
          return instance.get('Feature');
        },
        removeUnauthorizedSnapshots: true
    });

    //load the store
    snapshotStore.load({
      callback: function(records, operation) {
        if (operation.wasSuccessful()) {
          //process records
          debugger;
          console.log(records);
          app.add({
            xtype: 'rallygrid',
            store: snapshotStore,
            showRowActionsColumn: false,
            //features: ['grouping', 'groupingsummary'],
            features: [{
              ftype: 'groupingsummary',
              groupHeaderTpl: '{name} ({rows.length})'
            }],
            columnCfgs: [
              {
                // xtype: 'templatecolumn',
                text: 'ID',
                dataIndex: 'FormattedID',
                width: 100,
                // tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                renderer: function(value) {
                  //debugger;
                  return value;
                }
              }, {
                text: 'Name',
                dataIndex: 'Name'
              // }, {
              //     text: 'Plan Estimate',
              //     dataIndex: 'PlanEstimate'
              // }, {
              //     text: 'Previous PlanEstimate',
              //     dataIndex: '_PreviousValues',
              //     renderer: function(value){
              //       return value.PlanEstimate;
              // }
              }, {
                  text: 'Iteration',
                  dataIndex: 'Iteration',
                  renderer: function(value) {
                    //debugger;
                    return value.Name;
                  }
              }, {
                text: 'Previous Iteration',
                dataIndex: '_PreviousValues.Iteration',
                renderer: function(value) {
                  debugger;
                  return value.Name;
                }
              }
            ]
          });
        }
      }
    });
  }
});
