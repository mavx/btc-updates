from __future__ import print_function # Python 2/3 compatibility
from io import BytesIO
import psycopg2 as pg
import time
import csv
import os
import io

class Connection():
    def __init__(self, args={}):
        """Initialize connection instance"""
        try:
            if not args:
                # Use default config for direct connection
                args = {
                    'user': os.environ['PGUSER'],
                    'host': os.environ['PGHOST'],
                    'password': os.environ['PGPASSWORD'],
                    'port': os.environ['PGPORT']
                }

            # Default
            if 'application_name' not in args:
                args['application_name'] = 'Python: Psycopg2 v2.7'

            self.connection = pg.connect(**args)
            print('Connected to {}.'.format(args.get('dbname')))

        except KeyError as e:
            print(e.message)
            raise Exception('Missing environment variables.')

        except Exception as e:
            print(e.message)
            raise Exception('Check connection and login details, then retry.')

    def cursor(self):
        """Set cursor, re-establish DB connection if unsuccessful"""
        try:
            return self.connection.cursor()
        except pg.Error as e:
            print(e.pgerror)
            print('Reconnecting...')
            self.__init__() # Refresh connection
            return self.connection.cursor()

    def commit(self):
        """Commit transaction for this connection"""
        self.connection.commit()

    def rollback(self):
        """Rollback transaction for this connection"""
        self.connection.rollback()

    def encode(self, value):
        return value

    def execute(self, query, args=None, commit=False):        
        """Execute SQL statement using new cursor, print result if any"""
        cur = self.cursor()
        # Try executing SQL statement
        try:
            start = time.time()
            cur.execute(query, args)
            if commit:
                self.commit()

            # Print query results if any
            if cur.rowcount > 0:
                try:
                    results = cur.fetchall()

                    # Print header
                    try: header = [desc[0] for desc in cur.description]
                    except: header = None
                    print('Header', header)

                    # Print values
                    result_array = [header]
                    for i, row in enumerate(results):
                        print('Row {}: {}'.format(i+1, row))
                        result_array.append([self.encode(item) for item in row])
                    print('\n{} row(s) returned.'.format(cur.rowcount))

                except pg.ProgrammingError:
                    print(cur.statusmessage)
                    result_array = None
            else:
                print(cur.statusmessage)
                result_array = None

        except pg.Error as e:
            print(e.pgerror)
            return ('error', e.pgerror)
        finally:
            cur.close()
            print('Cursor closed.')
            print('Runtime: {:.2f}s'.format(time.time()-start))

        return result_array # for further processing

    def copyFrom(self, array, tbl_name, incr=50000):
        """ COPY array incrementally into PostgreSQL DB """
        cur = self.cursor()
        print('Inserting {} rows...'.format(len(array)))

        # Split array into smaller batches (by incr)
        for x in range(len(array)/incr + 1):
            working_array = array[x*incr:(x+1)*incr]

            # Transform array into psql readable output (tab delimiters RECOMMENDED)
            newArray = ['\t'.join(row) for row in working_array if len(row) > 0] # Join every row value with tab
            arrayObject = '\n'.join(newArray) # Join every row with newline

            # Create STDIN object
            output = io.StringIO()
            output.write(arrayObject)
            output.seek(0) # Move cursor to beginning of object

            # Copy values into PostgreSQL
            cur.copy_from(output, tbl_name, sep='\t') # using tab as separator
            print(cur.statusmessage)
        
        self.commit() # COMMIT ONLY IF TRANSACTION COMPLETES
        print('Transaction committed.\n')

    def copyExpert(
        self, file_list, tbl_name, 
        header=True, delimiter=',', quotechar='"', 
        encoding=None, mode='r'
        ):
        """ A more customisable COPY function """
        """ :file_list => File paths required in a list """
        cur = self.cursor()

        # Create arguments for COPY statement
        header_arg = ''
        if header:
            header_arg = 'HEADER'
        copy_sql = """
            COPY {} FROM STDIN WITH 
            CSV {} DELIMITER '{}' QUOTE '{}';
        """
        sql_statement = copy_sql.format(
            tbl_name, header_arg, 
            delimiter, quotechar
        )
        # Convert single file strings into list
        if isinstance(file_list, str):
            file_list = [file_list]

        total_rows = 0
        for filename in file_list:
            with open(filename, mode) as f:
                if encoding is not None:
                    recoded = f.read().decode(encoding).encode('utf-8')
                    f = BytesIO(recoded)

                rowcount = sum(1 for row in csv.reader(f)) - 1
                total_rows += rowcount
                print(
                    'Copying {} rows from {} into {}...'.format(
                        rowcount, filename, tbl_name
                    )
                )
                f.seek(0)
                cur.copy_expert(sql_statement, f)
                print(cur.statusmessage)

        self.commit() # COMMIT ONLY IF TRANSACTION COMPLETES
        print('Committed {} rows in this transaction.\n'.format(total_rows))

    def copyTo(self, filename, tbl_name, delimiter=',', quotechar='"'):
        """Write the content of a table into a file."""
        cur = self.cursor()
        copy_sql = """COPY {} TO STDOUT WITH CSV HEADER DELIMITER '{}' QUOTE '{}';"""
        sql_statement = copy_sql.format(tbl_name, delimiter, quotechar)
        with open(filename, 'w') as o:
            cur.copy_expert(sql_statement, o)
            print(cur.statusmessage)
        
        with open(filename, 'r') as f:
            rowcount = sum(1 for row in csv.reader(f)) - 1
            print('Copied {} rows into {}.'.format(rowcount, filename))

        self.commit()

    def count(self, table):
        """Count number of rows in table"""
        self.execute('SELECT COUNT(*) FROM {};'.format(table))

    def show(self, table, numrows):
        """Select first n rows from table"""
        self.execute('SELECT * FROM {} LIMIT {};'.format(table, numrows))

    def end(self):
        """Terminate current connection instance"""
        self.connection.close()
        print('Connection closed.\n')


if __name__ == '__main__':
    db = Connection()
    db.execute('SELECT NOW()')
    db.end()
