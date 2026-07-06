import {useState,useEffect,useRef} from 'react'

function Timer(){
    const [count,setCount] = useState(0);
    const timerRef = useRef(null);

    const startInterval=() =>{
        if(timerRef.current) clearTimeout(timerRef.current);

        const loop = () =>{
            setCount(prev=>++prev);
            // console.log(count);
            timerRef.current = setTimeout(loop,1000);
        }

        timerRef.current = setTimeout(loop,1000);
    }

    const stopInterval = ()=>{
        if(timerRef.current){ 
            clearTimeout(timerRef.current);
            timerRef.current=null;
        }
    }

    useEffect(()=>{
        startInterval();
        return ()=>stopInterval();
    },[]);

    return (
        <div>
            <h2>count: {count}</h2>
            <button onClick={startInterval}>start</button>
            <button onClick={stopInterval}>stop</button>
        </div>
    )
}

export default Timer;