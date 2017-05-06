# Loops

Task loops can made based conditions, cardinality, or a collection.

## Cardinality loop

Loop a fixed number of times or until number of iterations match cardinality. The cardinality body an integer or an expression.

```xml
<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">${variables.list.length}</bpmn:loopCardinality>
```

## Conditional loop

Loop until condition is met. The condition body can be a script or an expression.

```xml
<completionCondition xsi:type="tFormalExpression">\${services.condition(variables.input)}</completionCondition>
```

## Collection loop

Loop all items in a list.

```xml
<bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.list}" />
```

For `bpmn-moddle` to read the `camunda:collection` namespaced attribute, the engine must be instantiated with moddle options referring [`camunda-bpmn-moddle/resources/camunda`][1].
