import {wpCli} from "../helpers/wpCli";
import {parseTsvToJson} from "../helpers/parseTsvToJson";

async function createGoal(type, slug, classOrId = 'class', identifier, hook = '' ){
    let selector = classOrId === 'id' ? '#' + identifier : '.' + identifier;
    let title = "My "+type+" goal";
    let result = await wpCli(`db query --skip-column-names "SELECT COUNT(*) FROM wp_burst_goals WHERE title = '${title}'"`);
    let goalExists = parseInt(result.trim()) > 0;
    if ( !goalExists ) {
        let pageOrWebsite = type === 'visits' ? 'page' : 'website';
        await wpCli('burst add_goal ' +
            '--title="My '+type+' goal" ' +
            '--type="'+type+'" ' +
            '--status="active" ' +
            '--url="'+slug+'" ' +
            '--conversion_metric="visitors" ' +
            '--selector="'+selector+'" ' +
            '--page_or_website="'+pageOrWebsite+'" ' +
            '--specific_page="'+slug+'" ' + 
            '--hook="'+hook+'" '
        );

    }

    //retrieve the ID
    let goals = await wpCli(`db query "SELECT * FROM wp_burst_goals WHERE title = '${title}'"`);
    goals = parseTsvToJson(goals);
    return goals[0].ID;
}
export {createGoal}