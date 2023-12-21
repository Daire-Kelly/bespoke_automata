const express = require('express');
const fs = require('fs');

const { LGraph, LGraphCanvas, LiteGraph } = require('../libs/litegraph.js');
const Nodes = require('../libs/nodes.js');



async function load_graph(graph_file){
    console.log("loading graph: ", graph_file)
    const graphData = JSON.parse(fs.readFileSync(graph_file, 'utf8'));
    const graph = new LGraph();
    console.log("graphData: ", graphData)
    LiteGraph.clearRegisteredTypes()
    LiteGraph.registerNodeType("Text/Text", Nodes.Text_Node );
    LiteGraph.registerNodeType("Text/Random Text", Nodes.Random_Selection_Node );
    LiteGraph.registerNodeType("Templates/Persona Template", Nodes.Persona_Template_Node );
    LiteGraph.registerNodeType("Templates/Prompt Template", Nodes.Prompt_Template_Node );

    
    LiteGraph.registerNodeType("Text/Prefix Text", Nodes.Prefix_Text_Node );
    LiteGraph.registerNodeType("Text/Suffix Text", Nodes.Suffix_Text_Node );
    LiteGraph.registerNodeType("Text/Concatenate Text", Nodes.Concatenate_Text_Node );

    LiteGraph.registerNodeType("Storage/Weaviate Store", Nodes.Weaviate_Ingest_Node );
    LiteGraph.registerNodeType("Storage/Weaviate Query", Nodes.Weaviate_Query_Node );

    LiteGraph.registerNodeType("IO/Text Input", Nodes.Text_Input_Node );
    LiteGraph.registerNodeType("IO/Text Output", Nodes.Text_Output_Node );

    //Audio_Generation_Node
    LiteGraph.registerNodeType("Audio/Audio Generation", Nodes.Audio_Generation_Node );
    //Start_Node 
    LiteGraph.registerNodeType("Control/Start", Nodes.Start_Node );
    //Counter_Node
    LiteGraph.registerNodeType("Control/Counter", Nodes.Counter_Node );
    //Random_Number_Node
    LiteGraph.registerNodeType("Text/Random Number", Nodes.Random_Number_Node );
    // Gate
    LiteGraph.registerNodeType("Control/Gate", Nodes.Gate );
    // JSON_API_Node
    LiteGraph.registerNodeType("API/JSON API", Nodes.JSON_API_Node );
    // GPT_Node
    LiteGraph.registerNodeType("LLM/GPT", Nodes.GPT_Node );
    // Password_Node
    LiteGraph.registerNodeType("Text/Password", Nodes.Password_Node );
    //Prompt_Gate_GPT
    LiteGraph.registerNodeType("Control/Prompt Gate (GPT)", Nodes.Prompt_Gate_GPT );
    //Simple_Vector_DB_Read_Node
    LiteGraph.registerNodeType("Storage/Simple Vector DB Read", Nodes.Simple_Vector_DB_Read_Node );
    //Simple_Vector_DB_Write_Node
    LiteGraph.registerNodeType("Storage/Simple Vector DB Write", Nodes.Simple_Vector_DB_Write_Node );
    // Brain_Node
    LiteGraph.registerNodeType("Brains/Brain",Nodes.Brain_Node );
    // Variable_Forward_Node
    LiteGraph.registerNodeType("Text/Variable Forward", Nodes.Variable_Forward_Node );
    //Dictionary_Assembler_Node
    LiteGraph.registerNodeType("Text/Dictionary Assembler", Nodes.Dictionary_Assembler_Node );
    //Global_Variable_Get_Node
    LiteGraph.registerNodeType("Control/Global Variable Get", Nodes.Global_Variable_Get_Node );
    //Global_Variable_Set_Node
    LiteGraph.registerNodeType("Control/Global Variable Set", Nodes.Global_Variable_Set_Node );
    //Array_Assembler_Node
    LiteGraph.registerNodeType("Text/Array Assembler", Nodes.Array_Assembler_Node );
    //Array_Item_Forward_Node
    LiteGraph.registerNodeType("Text/Array Item Forward", Nodes.Array_Item_Forward_Node );
    //Array_Stepper_Node
    LiteGraph.registerNodeType("Control/Array Stepper", Nodes.Array_Stepper_Node );
    let e = graph.configure(graphData);
    if(e) {
        console.log("Error configuring graph: " + e);
        return;
    }
    return graph;
}

function set_inputs(graph, input_data){
    // for each input, find the node with the same name and set the value
    // input is an object where the node name is the key and the value is the value
    
    const textInputs = graph._nodes.filter(node => node.type === "IO/Text Input");
    
    textInputs.forEach(input => {
        const node = graph._nodes_by_id[input.id];
        
   

        if(node.title === input_data.name){
            console.log("setting input: ", input_data.name)
            node.properties.text = input_data.value;
        }
        
    });
}

function read_outputs(graph){
    // get the output from all the text output nodes and return it
    const textOutputs = graph._nodes.filter(node => node.type === "IO/Text Output");
    return textOutputs.map(output => {
        const node = graph._nodes_by_id[output.id];
        return {
            name: output.title || output.id,
            id: output.id,
            value: node.properties.text
        }
    });
}

async function run_step(graph){
    await graph.runStepAsync();
}

// TODO: save graph state to files

/*
app.get('/load_brain', async (req, res) => {
    const filename = req.query.graph;
    const input_data = JSON.parse(req.query.input);
    const result = await run(filename, input_data);
    console.log("result: ", result)
    res.send(result);
});
*/
let loaded_graphs = {};



async function load_graphs(app){
    // Load all the graphs in the graphs directory. parse the graph. graph.nodes is an array of nodes, find all the nodes with the type "IO/Text Input" and "IO/Text Output". Make an endpoint for each graph that takes the input data and returns the output data for each of the text output nodes.
    const graphs = fs.readdirSync('graphs');
    await graphs.forEach(async graph => {
        const filename = graph.split('.')[0];
        const extension = graph.split('.')[1];
        
        const graphObj = JSON.parse(fs.readFileSync('graphs/' + graph, 'utf8'));
        const textInputs = graphObj.nodes.filter(node => node.type === "IO/Text Input");
        const textOutputs = graphObj.nodes.filter(node => node.type === "IO/Text Output");
        let inputs = [];
        let outputs = [];
        textInputs.forEach(input => {
            const props = input.properties;
            inputs.push({
                name: input.title || input.id,
                id: input.id,
                value: "" 
            });
        });
        textOutputs.forEach(output => {
            const props = output.properties;
            outputs.push({
                name: output.title || output.id,
                id: output.id,
                value: "" 
            });
        });

        //console.log("loading graph: ", filename)
        
        loaded_graphs[filename] = await load_graph('graphs/' + graph);

        app.post('/brains/' + filename, async (req, res) => {
            // get json data from request
            const input_data = req.body;
            // if filename does note contain .brain at the end, add it
            //console.log("loaded_graphs: ", loaded_graphs)
            //console.log("filename: ", filename)
            set_inputs(loaded_graphs[filename], input_data);
            await run_step(loaded_graphs[filename], input_data);
            let outputs = read_outputs(loaded_graphs[filename]);
           // console.log("outputs: ", outputs)
            res.send(outputs);
        });
        // add a schema endpoint for each graph
        app.get('/brains/' + filename + '/schema', async (req, res) => {
            
            res.send({
                "inputs": inputs,
                "outputs": outputs
            });
        });
        // print all the endpoints
        //console.log("endpoints: ", app._router.stack.filter(r => r.route).map(r => r.route.path));
        
        
    });
}
const app = express();
var cors = require('cors')
app.use(cors())
const PORT = 9999;

async function start_server(){
    app.use(express.json());
    app.use(express.static('public'));
    await load_graphs(app);
    // add list of graphs endpoint
    app.get('/brains', async (req, res) => {
        const graphs = fs.readdirSync('graphs');
        res.send(graphs);
    });

    // print all the endpoints
    console.log("endpoints: ", app._router.stack.filter(r => r.route).map(r => r.route.path));
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
    

}

start_server();