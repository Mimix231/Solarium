import { Box } from '@mui/material';
import EditorTabs from '../features/editor/EditorTabs';
import MonacoEditorHost from '../features/editor/MonacoEditorHost';
export default function EditorArea(){return <Box sx={{height:'100%',minWidth:0,display:'flex',flexDirection:'column',bgcolor:'#101725'}}><EditorTabs/><Box sx={{flex:1,minHeight:0}}><MonacoEditorHost/></Box></Box>}
