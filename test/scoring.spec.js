import { filterIntersectingHierarchy } from '../js/scoring'

jest.mock('./../js/adapt.js', () => {
  return class Adapt {
      constructor(name){
          this.name = name;
      }
  }   
});

jest.mock('./../js/data.js', () => {
  return class Data {
      constructor(name){
          this.name = name;
      }
  }   
});

// rather than use a real Backbone.Model use a simple mock
const makeMockModel = (props) => {
  return _.extend({
    get: (key) => props[key],
    getAllDescendantModels: () => props.descendants || []
  }, props);
}

describe('filterIntersectingHierarchy', function() {
  let leafA = makeMockModel({_id:'leafA'});
  let leafB = makeMockModel({_id:'leafB'});
  let nodeB = makeMockModel({_id:'nodeB', descendants:[leafB]});

  it('Returns models from listA which are present in listB', function(done) {
    let listA = [leafA];
    let listB = [leafA, leafB];
    let filtered = filterIntersectingHierarchy(listA, listB);
    expect(filtered).toEqual(expect.arrayContaining([leafA]));
    done();
  });

  it('Returns models from listA which are descendants of models in listB', function(done) {
    let listA = [leafB];
    let listB = [nodeB];
    let filtered = filterIntersectingHierarchy(listA, listB);
    expect(filtered).toEqual(expect.arrayContaining([leafB]));
    done();
  });

  it('Returns models from listA which are ancestors of models in listB', function(done) {
    let listA = [nodeB];
    let listB = [leafB];
    let filtered = filterIntersectingHierarchy(listA, listB);
    expect(filtered).toEqual(expect.arrayContaining([nodeB]));
    done();
  });
});